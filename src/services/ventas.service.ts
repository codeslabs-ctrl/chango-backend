import { pool, query } from '../config/db';
import type {
  Venta,
  VentaDetalle,
  VentaConDetalles,
  CreateVentaDto,
  CreateVentaDetalleDto
} from '../models/venta.model';
import { AppError, NotFoundError } from '../utils/errors';
import * as productosService from './productos.service';

export async function crearVenta(
  dto: CreateVentaDto
): Promise<{ venta: Venta; detalles: CreateVentaDetalleDto[] }> {
  const { cliente_id, metodo_pago, detalles, confirmar = false } = dto;

  if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError('La venta debe tener al menos un detalle', 400);
  }

  for (const d of detalles) {
    if (!d.despachos || !Array.isArray(d.despachos)) {
      throw new AppError(`El producto ${d.producto_id} debe tener despachos por almacén`, 400);
    }
    const sumaDespachos = d.despachos.reduce((s, x) => s + (Number(x.cantidad) || 0), 0);
    if (Math.abs(sumaDespachos - Number(d.cantidad)) > 0.001) {
      throw new AppError(
        `La suma de despachos (${sumaDespachos}) debe ser igual a la cantidad (${d.cantidad}) para el producto ${d.producto_id}`,
        400
      );
    }
  }

  for (const d of detalles) {
    const producto = await productosService.findProductoById(d.producto_id);
    if (!producto) throw new AppError(`Producto ${d.producto_id} no encontrado`, 404);
    const existencia = Number(producto.existencia_actual) || 0;
    if (existencia < Number(d.cantidad)) {
      throw new AppError(
        `Stock insuficiente para ${producto.descripcion}: existencia actual ${existencia}, solicitado ${d.cantidad}`,
        400
      );
    }
    const precio = Number(producto.precio_venta_sugerido) || 0;
    if (precio <= 0) {
      throw new AppError(`El producto ${producto.descripcion} no tiene precio de venta configurado`, 400);
    }

    const almacenes = await productosService.getProductoAlmacenes(d.producto_id);

    for (const desp of d.despachos) {
      if ((desp.cantidad || 0) <= 0) continue;
      const pa = almacenes.find(a => a.almacen_id === desp.almacen_id);
      const stock = pa?.stock_actual ?? 0;
      if (stock < desp.cantidad) {
        throw new AppError(
          `Stock insuficiente en almacén para ${producto.descripcion}: almacén ${pa?.almacen_nombre || desp.almacen_id} tiene ${stock}, solicitado ${desp.cantidad}`,
          400
        );
      }
    }
  }

  const estatus = confirmar ? 'CONFIRMADA' : 'POR CONFIRMAR';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const totalVenta = detalles.reduce(
      (acc, d) => acc + Number(d.cantidad) * Number(d.precio_unitario),
      0
    );

    const ventaRes = await client.query<Venta>(
      `INSERT INTO public.ventas (cliente_id, total_venta, metodo_pago, estatus)
       VALUES ($1, $2, $3, $4)
       RETURNING venta_id, cliente_id, fecha_venta, total_venta, metodo_pago, estatus`,
      [cliente_id ?? null, totalVenta, metodo_pago || null, estatus]
    );

    const venta = ventaRes.rows[0];

    for (const d of detalles) {
      await client.query(
        `INSERT INTO public.ventas_detalle (
           venta_id, producto_id, cantidad, precio_unitario
         ) VALUES ($1, $2, $3, $4)`,
        [venta.venta_id, d.producto_id, d.cantidad, d.precio_unitario]
      );

      for (const desp of d.despachos) {
        if ((desp.cantidad || 0) <= 0) continue;
        await client.query(
          `INSERT INTO public.ventas_detalle_despacho (venta_id, producto_id, almacen_id, cantidad)
           VALUES ($1, $2, $3, $4)`,
          [venta.venta_id, d.producto_id, desp.almacen_id, desp.cantidad]
        );
      }

      if (confirmar) {
        for (const desp of d.despachos) {
          if ((desp.cantidad || 0) <= 0) continue;
          await client.query(
            `UPDATE public.producto_almacenes
             SET stock_actual = COALESCE(stock_actual, 0) - $1
             WHERE producto_id = $2 AND almacen_id = $3`,
            [desp.cantidad, d.producto_id, desp.almacen_id]
          );
        }
        await client.query(
          `UPDATE public.productos
           SET existencia_actual = COALESCE(existencia_actual, 0) - $1
           WHERE producto_id = $2`,
          [d.cantidad, d.producto_id]
        );
      }
    }

    await client.query('COMMIT');

    return { venta, detalles };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findVentaById(id: number): Promise<VentaConDetalles | null> {
  const { rows: ventas } = await query<Venta>(
    `SELECT v.venta_id,
            v.cliente_id,
            c.nombre as cliente_nombre,
            c.cedula_rif as cliente_cedula_rif,
            c.telefono as cliente_telefono,
            v.fecha_venta,
            v.total_venta,
            v.metodo_pago,
            v.estatus
     FROM public.ventas v
     LEFT JOIN public.clientes c ON c.cliente_id = v.cliente_id
     WHERE v.venta_id = $1`,
    [id]
  );

  const venta = ventas[0];
  if (!venta) return null;

  const { rows: detalles } = await query<VentaDetalle>(
    `SELECT d.detalle_id,
            d.producto_id,
            p.descripcion as producto_descripcion,
            d.cantidad,
            d.precio_unitario
     FROM public.ventas_detalle d
     JOIN public.productos p ON p.producto_id = d.producto_id
     WHERE d.venta_id = $1`,
    [id]
  );

  return { venta, detalles };
}

export interface VentasFilters {
  clienteId?: number;
  estatus?: string;
}

export async function findAllVentas(filters?: VentasFilters): Promise<Venta[]> {
  const params: (number | string)[] = [];
  const conditions: string[] = [];

  if (filters?.clienteId) {
    params.push(filters.clienteId);
    conditions.push(`v.cliente_id = $${params.length}`);
  }
  if (filters?.estatus) {
    if (filters.estatus === 'POR CONFIRMAR') {
      conditions.push(`(v.estatus = 'POR CONFIRMAR' OR v.estatus = 'PENDIENTE')`);
    } else {
      params.push(filters.estatus);
      conditions.push(`v.estatus = $${params.length}`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query<Venta>(
    `SELECT v.venta_id,
            v.cliente_id,
            c.nombre as cliente_nombre,
            c.telefono as cliente_telefono,
            (SELECT string_agg(p.descripcion, ', ')
             FROM public.ventas_detalle vd
             JOIN public.productos p ON p.producto_id = vd.producto_id
             WHERE vd.venta_id = v.venta_id) as productos_nombres,
            v.fecha_venta,
            v.total_venta,
            v.metodo_pago,
            v.estatus
     FROM public.ventas v
     LEFT JOIN public.clientes c ON c.cliente_id = v.cliente_id
     ${where}
     ORDER BY v.fecha_venta DESC`,
    params
  );

  return rows;
}

export async function confirmarVenta(id: number): Promise<VentaConDetalles | null> {
  const data = await findVentaById(id);
  const estatusValido = data?.venta.estatus === 'PENDIENTE' || data?.venta.estatus === 'POR CONFIRMAR';
  if (!data || !estatusValido) return null;

  const { rows: despachos } = await query<{ producto_id: number; almacen_id: number; cantidad: number }>(
    `SELECT producto_id, almacen_id, cantidad FROM public.ventas_detalle_despacho WHERE venta_id = $1`,
    [id]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (despachos.length > 0) {
      for (const desp of despachos) {
        await client.query(
          `UPDATE public.producto_almacenes
           SET stock_actual = COALESCE(stock_actual, 0) - $1
           WHERE producto_id = $2 AND almacen_id = $3`,
          [desp.cantidad, desp.producto_id, desp.almacen_id]
        );
      }
      const cantidadesPorProducto = new Map<number, number>();
      for (const d of data.detalles) {
        cantidadesPorProducto.set(d.producto_id, d.cantidad);
      }
      for (const [productoId, cantidad] of cantidadesPorProducto) {
        await client.query(
          `UPDATE public.productos
           SET existencia_actual = COALESCE(existencia_actual, 0) - $1
           WHERE producto_id = $2`,
          [cantidad, productoId]
        );
      }
    } else {
      for (const d of data.detalles) {
        await client.query(
          `UPDATE public.productos
           SET existencia_actual = COALESCE(existencia_actual, 0) - $1
           WHERE producto_id = $2`,
          [d.cantidad, d.producto_id]
        );
      }
    }

    await client.query(
      `UPDATE public.ventas SET estatus = 'CONFIRMADA' WHERE venta_id = $1`,
      [id]
    );

    await client.query('COMMIT');
    const result = await findVentaById(id);
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function eliminarVenta(id: number): Promise<VentaConDetalles | null> {
  const data = await findVentaById(id);
  if (!data) return null;

  await query(
    `UPDATE public.ventas SET estatus = 'ELIMINADA' WHERE venta_id = $1`,
    [id]
  );

  return findVentaById(id);
}
