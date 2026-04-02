import { pool, query } from '../config/db';
import type {
  Venta,
  VentaDetalle,
  VentaConDetalles,
  CreateVentaDto,
  CreateVentaDetalleDto,
  ConfirmarVentaDto
} from '../models/venta.model';
import { AppError, NotFoundError } from '../utils/errors';
import * as productosService from './productos.service';
import {
  normalizarTipoPago,
  TIPO_PAGO_A_CONVENIR,
  requiereReferenciaTipoPago,
  esTipoPagoValidoParaScroll
} from '../utils/metodosPago';

/** Solo ventas con este usuario asignado (vendedor); exige coincidencia exacta, sin acceso a ventas sin asignar. */
export function vendedorPuedeAccederVenta(venta: Venta, userId: number): boolean {
  return venta.usuario_id != null && venta.usuario_id === userId;
}

export async function crearVenta(
  dto: CreateVentaDto,
  /** Solo se guarda cuando el creador es vendedor (lo setea la ruta con el id del JWT). */
  usuarioIdVendedor?: number | null
): Promise<{ venta: Venta; detalles: CreateVentaDetalleDto[] }> {
  const {
    cliente_id,
    metodo_pago,
    tipo_pago,
    referencia_banco,
    referencia_pago,
    detalles,
    confirmar = false
  } = dto;

  const refLinea = (referencia_banco ?? referencia_pago ?? '').toString().trim();
  let tipoPago = normalizarTipoPago(tipo_pago ?? metodo_pago);

  if (confirmar) {
    if (!esTipoPagoValidoParaScroll(tipoPago)) {
      throw new AppError(
        'Elegí un método de pago válido (efectivo, transferencia o pago móvil).',
        400
      );
    }
    if (requiereReferenciaTipoPago(tipoPago) && !refLinea) {
      throw new AppError(
        'Indicá el número de referencia para transferencia o pago móvil.',
        400
      );
    }
  } else if (usuarioIdVendedor != null) {
    if (!esTipoPagoValidoParaScroll(tipoPago)) {
      throw new AppError(
        'Elegí un método de pago (efectivo, transferencia o pago móvil).',
        400
      );
    }
  } else {
    if (!esTipoPagoValidoParaScroll(tipoPago)) {
      tipoPago = TIPO_PAGO_A_CONVENIR;
    }
  }

  if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError('La venta debe tener al menos un producto en el detalle.', 400);
  }

  for (const d of detalles) {
    if (!d.despachos || !Array.isArray(d.despachos)) {
      throw new AppError(
        'Indicá en qué almacén se entrega cada producto (cantidad por almacén).',
        400
      );
    }
    const sumaDespachos = d.despachos.reduce((s, x) => s + (Number(x.cantidad) || 0), 0);
    if (Math.abs(sumaDespachos - Number(d.cantidad)) > 0.001) {
      throw new AppError(
        `La suma de cantidades por almacén (${sumaDespachos}) debe coincidir con la cantidad total (${d.cantidad}).`,
        400
      );
    }
  }

  for (const d of detalles) {
    const producto = await productosService.findProductoById(d.producto_id);
    if (!producto) throw new AppError('No encontramos uno de los productos de la venta.', 404);
    const existencia = Number(producto.existencia_actual) || 0;
    if (existencia < Number(d.cantidad)) {
      throw new AppError(
        `No hay stock suficiente para «${producto.descripcion}». Disponible: ${existencia}, pedido: ${d.cantidad}.`,
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
          `En el almacén «${pa?.almacen_nombre || String(desp.almacen_id)}» no hay stock suficiente para «${producto.descripcion}». Disponible: ${stock}, pedido: ${desp.cantidad}.`,
          400
        );
      }
    }
  }

  const uid =
    usuarioIdVendedor != null && usuarioIdVendedor > 0 ? usuarioIdVendedor : null;

  /** Sin confirmar en alta: POR FACTURAR (vendedor vs agente se distingue por usuario_id). */
  let estatus: string;
  if (confirmar) {
    estatus = 'FACTURADA';
  } else {
    estatus = 'POR FACTURAR';
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const totalVenta = detalles.reduce(
      (acc, d) => acc + Number(d.cantidad) * Number(d.precio_unitario),
      0
    );

    const ventaRes = await client.query<Venta>(
      `INSERT INTO public.ventas (cliente_id, total_venta, metodo_pago, estatus, usuario_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING venta_id, cliente_id, usuario_id, fecha_venta, total_venta, metodo_pago, estatus`,
      [cliente_id ?? null, totalVenta, tipoPago, estatus, uid]
    );

    const venta = ventaRes.rows[0];

    await client.query(
      `INSERT INTO public.metodo_pago (venta_id, tipo_pago, referencia_banco)
       VALUES ($1, $2, $3)`,
      [venta.venta_id, tipoPago, refLinea || null]
    );

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
            c.email as cliente_email,
            c.direccion as cliente_direccion,
            v.usuario_id,
            u.nombre_usuario as usuario_nombre,
            v.fecha_venta,
            v.total_venta,
            v.metodo_pago,
            v.referencia_pago,
            v.estatus,
            COALESCE(mp.tipo_pago, v.metodo_pago) AS tipo_pago,
            COALESCE(mp.referencia_banco, v.referencia_pago) AS referencia_banco
     FROM public.ventas v
     LEFT JOIN public.clientes c ON c.cliente_id = v.cliente_id
     LEFT JOIN public.usuarios u ON u.id = v.usuario_id
     LEFT JOIN LATERAL (
       SELECT mp.tipo_pago, mp.referencia_banco
       FROM public.metodo_pago mp
       WHERE mp.venta_id = v.venta_id
       ORDER BY mp.metodo_id DESC
       LIMIT 1
     ) mp ON true
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

type ProductoDestaque = {
  imagen_url: string | null;
  descripcion: string | null;
  cantidad: number;
};

/** pg puede devolver `json` como objeto, string JSON o Buffer según versión/driver. */
function normalizeProductosDestaque(raw: unknown): ProductoDestaque[] {
  if (raw == null) return [];
  let data: unknown = raw;

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
    try {
      data = JSON.parse(raw.toString('utf8'));
    } catch {
      return [];
    }
  } else if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t === 'null') return [];
    try {
      data = JSON.parse(t);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    if (!item || typeof item !== 'object') {
      return { imagen_url: null, descripcion: null, cantidad: 0 };
    }
    const o = item as Record<string, unknown>;
    const urlVal = o.imagen_url ?? o.imagenUrl ?? o.IMAGEN_URL;
    const imagen_url =
      urlVal == null || urlVal === '' ? null : String(urlVal).trim() || null;
    const descVal = o.descripcion;
    const descripcion = descVal == null ? null : String(descVal);
    const cantidad = Number(o.cantidad);
    return {
      imagen_url,
      descripcion,
      cantidad: Number.isFinite(cantidad) ? cantidad : 0
    };
  });
}

export interface VentasFilters {
  clienteId?: number;
  estatus?: string;
  /** YYYY-MM-DD inclusive */
  fechaDesde?: string;
  /** YYYY-MM-DD inclusive */
  fechaHasta?: string;
  /** Texto libre: cliente, teléfono, cédula, método de pago, productos, o ID de venta */
  busqueda?: string;
  /** Si viene informado, solo ventas de ese usuario (uso interno: vendedor autenticado). */
  usuarioId?: number;
  /**
   * Cola dashboard: pendientes con vendedor (usuario_id no nulo) vs agente (usuario_id nulo).
   * Si se define, filtra estados pendientes y no debe combinarse con `estatus` genérico en el cliente.
   */
  pendientesTipo?: 'vendedor' | 'agente';
}

export async function findAllVentas(filters?: VentasFilters): Promise<Venta[]> {
  const params: (number | string)[] = [];
  const conditions: string[] = [];

  if (filters?.clienteId) {
    params.push(filters.clienteId);
    conditions.push(`v.cliente_id = $${params.length}`);
  }
  if (filters?.usuarioId != null && filters.usuarioId > 0) {
    params.push(filters.usuarioId);
    conditions.push(`v.usuario_id = $${params.length}`);
  }

  const pt = filters?.pendientesTipo;
  if (pt === 'vendedor' || pt === 'agente') {
    conditions.push(`(v.estatus IN ('POR FACTURAR', 'PENDIENTE'))`);
    conditions.push(`v.estatus NOT IN ('FACTURADA', 'ELIMINADA')`);
    if (pt === 'vendedor') {
      conditions.push(`v.usuario_id IS NOT NULL`);
    } else {
      conditions.push(`v.usuario_id IS NULL`);
    }
  } else if (filters?.estatus) {
    const e = filters.estatus.trim();
    if (e === 'POR FACTURAR') {
      conditions.push(`(v.estatus IN ('POR FACTURAR', 'PENDIENTE'))`);
    } else {
      params.push(e);
      conditions.push(`v.estatus = $${params.length}`);
    }
  }

  if (filters?.fechaDesde && /^\d{4}-\d{2}-\d{2}$/.test(filters.fechaDesde)) {
    params.push(filters.fechaDesde);
    conditions.push(`v.fecha_venta::date >= $${params.length}::date`);
  }
  if (filters?.fechaHasta && /^\d{4}-\d{2}-\d{2}$/.test(filters.fechaHasta)) {
    params.push(filters.fechaHasta);
    conditions.push(`v.fecha_venta::date <= $${params.length}::date`);
  }

  const qRaw = filters?.busqueda?.trim();
  if (qRaw) {
    const term = `%${qRaw}%`;
    params.push(term);
    const likeIdx = params.length;
    const orParts: string[] = [
      `c.nombre ILIKE $${likeIdx}`,
      `COALESCE(c.telefono, '') ILIKE $${likeIdx}`,
      `COALESCE(c.cedula_rif, '') ILIKE $${likeIdx}`,
      `COALESCE(v.metodo_pago, '') ILIKE $${likeIdx}`,
      `EXISTS (
         SELECT 1 FROM public.ventas_detalle vd
         JOIN public.productos p ON p.producto_id = vd.producto_id
         WHERE vd.venta_id = v.venta_id AND p.descripcion ILIKE $${likeIdx}
       )`
    ];
    if (/^\d+$/.test(qRaw)) {
      const idNum = parseInt(qRaw, 10);
      if (!Number.isNaN(idNum)) {
        params.push(idNum);
        orParts.push(`v.venta_id = $${params.length}`);
      }
    }
    conditions.push(`(${orParts.join(' OR ')})`);
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
            (SELECT COUNT(*)::int FROM public.ventas_detalle vd WHERE vd.venta_id = v.venta_id) as cantidad_productos,
            (SELECT COALESCE(
               (SELECT json_agg(
                  json_build_object(
                    'imagen_url', s.imagen_url,
                    'descripcion', s.descripcion,
                    'cantidad', s.cantidad
                  )
                  ORDER BY s.ord_cant DESC, s.detalle_id ASC
                )
                FROM (
                  SELECT p.imagen_url,
                         p.descripcion,
                         vd.cantidad::double precision AS cantidad,
                         vd.cantidad AS ord_cant,
                         vd.detalle_id
                  FROM public.ventas_detalle vd
                  INNER JOIN public.productos p ON p.producto_id = vd.producto_id
                  WHERE vd.venta_id = v.venta_id
                  ORDER BY vd.cantidad DESC, vd.detalle_id ASC
                ) s
               ),
               '[]'::json
             )) AS productos_destaque,
            v.usuario_id,
            u.nombre_usuario as usuario_nombre,
            v.fecha_venta,
            v.total_venta,
            v.metodo_pago,
            v.estatus
     FROM public.ventas v
     LEFT JOIN public.clientes c ON c.cliente_id = v.cliente_id
     LEFT JOIN public.usuarios u ON u.id = v.usuario_id
     ${where}
     ORDER BY v.fecha_venta DESC`,
    params
  );

  for (const row of rows) {
    const r = row as Venta & { productos_destaque?: unknown };
    r.productos_destaque = normalizeProductosDestaque(r.productos_destaque);
  }

  return rows;
}

export async function confirmarVenta(
  id: number,
  dto?: ConfirmarVentaDto | null
): Promise<VentaConDetalles | null> {
  const data = await findVentaById(id);
  const estatusValido =
    data?.venta.estatus === 'PENDIENTE' || data?.venta.estatus === 'POR FACTURAR';
  if (!data || !estatusValido) return null;

  const tipoActual = normalizarTipoPago(
    data.venta.tipo_pago ?? data.venta.metodo_pago ?? ''
  );
  const refExistente = (
    data.venta.referencia_banco ??
    data.venta.referencia_pago ??
    ''
  )
    .toString()
    .trim();

  const refDto = (dto?.referencia_banco ?? dto?.referencia_pago ?? '').toString().trim();

  let tipoFinal: string;
  let refFinal: string;

  const ventaSinVendedor = data.venta.usuario_id == null;

  if (ventaSinVendedor) {
    const tipoDto = normalizarTipoPago(dto?.tipo_pago ?? dto?.metodo_pago ?? '');
    if (!esTipoPagoValidoParaScroll(tipoDto)) {
      throw new AppError(
        'Elegí un método de pago (efectivo, transferencia o pago móvil).',
        400
      );
    }
    tipoFinal = tipoDto;
    refFinal = refDto || refExistente;
  } else {
    tipoFinal = tipoActual;
    refFinal = refDto || refExistente;
    if (!esTipoPagoValidoParaScroll(tipoFinal)) {
      throw new AppError(
        'Esta venta no tiene un método de pago válido para confirmar (no puede ser «a convenir»).',
        400
      );
    }
  }

  if (requiereReferenciaTipoPago(tipoFinal) && !refFinal) {
    throw new AppError(
      'Indicá el número de referencia para transferencia o pago móvil.',
      400
    );
  }

  let clienteUpdate: ConfirmarVentaDto['cliente'] | null = null;
  if (data.venta.cliente_id && dto?.cliente) {
    const x = dto.cliente;
    const nombre = (x.nombre ?? '').trim();
    if (!nombre) {
      throw new AppError('El nombre del cliente es obligatorio.', 400);
    }
    clienteUpdate = x;
  }

  const refGuardar = requiereReferenciaTipoPago(tipoFinal)
    ? refFinal
    : refDto || refExistente || null;

  const { rows: despachos } = await query<{ producto_id: number; almacen_id: number; cantidad: number }>(
    `SELECT producto_id, almacen_id, cantidad FROM public.ventas_detalle_despacho WHERE venta_id = $1`,
    [id]
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (clienteUpdate && data.venta.cliente_id) {
      const x = clienteUpdate;
      const nombre = (x.nombre ?? '').trim();
      await client.query(
        `UPDATE public.clientes SET
           nombre = $1,
           cedula_rif = NULLIF(TRIM($2), ''),
           telefono = NULLIF(TRIM($3), ''),
           email = NULLIF(TRIM($4), ''),
           direccion = NULLIF(TRIM($5), '')
         WHERE cliente_id = $6`,
        [
          nombre,
          x.cedula_rif ?? '',
          x.telefono ?? '',
          x.email ?? '',
          x.direccion ?? '',
          data.venta.cliente_id
        ]
      );
    }

    await client.query(
      `UPDATE public.ventas
       SET metodo_pago = $1,
           referencia_pago = $2
       WHERE venta_id = $3`,
      [tipoFinal, refGuardar || null, id]
    );

    await client.query(`DELETE FROM public.metodo_pago WHERE venta_id = $1`, [id]);
    await client.query(
      `INSERT INTO public.metodo_pago (venta_id, tipo_pago, referencia_banco)
       VALUES ($1, $2, $3)`,
      [id, tipoFinal, refGuardar || null]
    );

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
        const almacenes = await productosService.getProductoAlmacenes(d.producto_id);
        let remaining = Number(d.cantidad) || 0;
        for (const a of almacenes) {
          if (remaining <= 0) break;
          const stock = a.stock_actual ?? 0;
          const toReduce = Math.min(remaining, stock);
          if (toReduce > 0) {
            await client.query(
              `UPDATE public.producto_almacenes
               SET stock_actual = COALESCE(stock_actual, 0) - $1
               WHERE producto_id = $2 AND almacen_id = $3`,
              [toReduce, d.producto_id, a.almacen_id]
            );
            remaining -= toReduce;
          }
        }
        await client.query(
          `UPDATE public.productos
           SET existencia_actual = COALESCE(existencia_actual, 0) - $1
           WHERE producto_id = $2`,
          [d.cantidad, d.producto_id]
        );
      }
    }

    await client.query(
      `UPDATE public.ventas SET estatus = 'FACTURADA' WHERE venta_id = $1`,
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
