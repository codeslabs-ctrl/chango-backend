import { pool, query } from '../config/db';
import type {
  Producto,
  CreateProductoDto,
  UpdateProductoDto
} from '../models/producto.model';
import { AppError, NotFoundError } from '../utils/errors';

async function validarAlmacenesActivos(almacenIds: number[]): Promise<void> {
  if (almacenIds.length === 0) return;
  const { rows } = await query<{ almacen_id: number; nombre: string }>(
    `SELECT almacen_id, nombre FROM public.almacenes
     WHERE almacen_id = ANY($1) AND COALESCE(estatus, 'A') != 'A'`,
    [almacenIds]
  );
  if (rows.length > 0) {
    const nombres = rows.map(r => r.nombre).join(', ');
    throw new AppError(
      `Solo se pueden asociar productos a almacenes activos. Los siguientes están inactivos: ${nombres}`,
      400
    );
  }
}

export interface ProductosFilters {
  subcategoriaId?: number;
  proveedorId?: number;
  almacenId?: number;
}

export async function findAllProductos(filters?: ProductosFilters): Promise<Producto[]> {
  const params: number[] = [];
  const conditions: string[] = [];
  const almacenId = filters?.almacenId;

  if (filters?.subcategoriaId) {
    params.push(filters.subcategoriaId);
    conditions.push(`p.subcategoria_id = $${params.length}`);
  }
  if (filters?.proveedorId) {
    params.push(filters.proveedorId);
    conditions.push(`p.proveedor_id = $${params.length}`);
  }
  let almacenParamIndex = 0;
  if (almacenId) {
    params.push(almacenId);
    almacenParamIndex = params.length;
    conditions.push(`pa.almacen_id = $${almacenParamIndex}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joinAlmacen = almacenId
    ? `INNER JOIN public.producto_almacenes pa ON pa.producto_id = p.producto_id AND pa.almacen_id = $${almacenParamIndex}`
    : '';
  const existenciaField = almacenId ? 'pa.stock_actual as existencia_actual' : 'p.existencia_actual';

  const { rows } = await query<Producto>(
    `SELECT p.producto_id,
            p.codigo_interno,
            p.descripcion,
            p.nombre,
            p.subcategoria_id,
            s.nombre as subcategoria_nombre,
            p.proveedor_id,
            pr.nombre_empresa as proveedor_nombre,
            ${existenciaField},
            p.unidad_medida,
            p.precio_venta_sugerido,
            p.fecha_ultimo_inventario,
            COALESCE(p.estatus, 'A') as estatus,
            EXISTS(SELECT 1 FROM public.ventas_detalle vd WHERE vd.producto_id = p.producto_id) as tiene_ventas
     FROM public.productos p
     LEFT JOIN public.subcategorias s ON s.subcategoria_id = p.subcategoria_id
     LEFT JOIN public.proveedores pr ON pr.proveedor_id = p.proveedor_id
     ${joinAlmacen}
     ${where}
     ORDER BY p.producto_id DESC`,
    params
  );
  return rows;
}

export async function findProductoById(id: number): Promise<Producto | null> {
  const { rows } = await query<Producto>(
    `SELECT p.producto_id,
            p.codigo_interno,
            p.descripcion,
            p.nombre,
            p.subcategoria_id,
            s.nombre as subcategoria_nombre,
            p.proveedor_id,
            pr.nombre_empresa as proveedor_nombre,
            p.existencia_actual,
            p.unidad_medida,
            p.precio_venta_sugerido,
            p.fecha_ultimo_inventario,
            COALESCE(p.estatus, 'A') as estatus
     FROM public.productos p
     LEFT JOIN public.subcategorias s ON s.subcategoria_id = p.subcategoria_id
     LEFT JOIN public.proveedores pr ON pr.proveedor_id = p.proveedor_id
     WHERE p.producto_id = $1`,
    [id]
  );
  return rows[0] || null;
}

export interface ProductoAlmacenInfo {
  almacen_id: number;
  almacen_nombre: string;
  stock_actual: number;
}

export async function getProductoAlmacenes(productoId: number): Promise<ProductoAlmacenInfo[]> {
  const { rows } = await query<ProductoAlmacenInfo>(
    `SELECT pa.almacen_id, a.nombre as almacen_nombre, pa.stock_actual
     FROM public.producto_almacenes pa
     JOIN public.almacenes a ON a.almacen_id = pa.almacen_id
     WHERE pa.producto_id = $1
     ORDER BY a.nombre`,
    [productoId]
  );
  return rows;
}

export async function createProducto(dto: CreateProductoDto): Promise<Producto> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertRes = await client.query<Producto>(
      `INSERT INTO public.productos (
          codigo_interno,
          descripcion,
          nombre,
          subcategoria_id,
          proveedor_id,
          existencia_actual,
          unidad_medida,
          precio_venta_sugerido,
          estatus
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
                 proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido,
                 fecha_ultimo_inventario, estatus`,
      [
        dto.codigo_interno,
        dto.descripcion,
        dto.nombre || null,
        dto.subcategoria_id ?? null,
        dto.proveedor_id ?? null,
        0,
        dto.unidad_medida || null,
        dto.precio_venta_sugerido ?? 0,
        dto.estatus || 'A'
      ]
    );
    const producto = insertRes.rows[0];
    const almacenes = dto.almacenes || [];
    await validarAlmacenesActivos(almacenes.map(a => a.almacen_id));
    let existenciaTotal = 0;
    for (const a of almacenes) {
      const stock = a.stock_actual ?? 0;
      existenciaTotal += stock;
      await client.query(
        `INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
         VALUES ($1, $2, $3, 0, 0)`,
        [producto.producto_id, a.almacen_id, stock]
      );
    }
    await client.query(
      `UPDATE public.productos SET existencia_actual = $1 WHERE producto_id = $2`,
      [existenciaTotal, producto.producto_id]
    );
    await client.query('COMMIT');
    return producto;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProducto(id: number, dto: UpdateProductoDto): Promise<Producto> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateRes = await client.query<Producto>(
      `UPDATE public.productos
       SET codigo_interno = $1,
           descripcion = $2,
           nombre = $3,
           subcategoria_id = $4,
           proveedor_id = $5,
           unidad_medida = $6,
           precio_venta_sugerido = $7,
           fecha_ultimo_inventario = now(),
           estatus = COALESCE($8::char, estatus, 'A')
       WHERE producto_id = $9
       RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
                 proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido,
                 fecha_ultimo_inventario, COALESCE(estatus, 'A') as estatus`,
      [
        dto.codigo_interno ?? null,
        dto.descripcion ?? null,
        dto.nombre ?? null,
        dto.subcategoria_id ?? null,
        dto.proveedor_id ?? null,
        dto.unidad_medida ?? null,
        dto.precio_venta_sugerido ?? 0,
        dto.estatus ?? null,
        id
      ]
    );
    if (!updateRes.rows[0]) throw new NotFoundError('Producto');
    if (dto.almacenes !== undefined && Array.isArray(dto.almacenes)) {
      await validarAlmacenesActivos(dto.almacenes.map(a => a.almacen_id));
      const currentRes = await client.query<{ almacen_id: number }>(
        `SELECT almacen_id FROM public.producto_almacenes WHERE producto_id = $1`,
        [id]
      );
      const currentIds = new Set(currentRes.rows.map(r => r.almacen_id));
      const newIds = new Set(dto.almacenes.map(a => a.almacen_id));
      const toRemove = [...currentIds].filter(a => !newIds.has(a));
      for (const almacenId of toRemove) {
        await client.query(
          `DELETE FROM public.producto_almacenes WHERE producto_id = $1 AND almacen_id = $2`,
          [id, almacenId]
        );
      }
      let existenciaTotal = 0;
      for (const a of dto.almacenes) {
        const stock = a.stock_actual ?? 0;
        existenciaTotal += stock;
        const exists = currentIds.has(a.almacen_id);
        if (exists) {
          await client.query(
            `UPDATE public.producto_almacenes SET stock_actual = $1
             WHERE producto_id = $2 AND almacen_id = $3`,
            [stock, id, a.almacen_id]
          );
        } else {
          await client.query(
            `INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
             VALUES ($1, $2, $3, 0, 0)`,
            [id, a.almacen_id, stock]
          );
        }
      }
      await client.query(
        `UPDATE public.productos SET existencia_actual = $1 WHERE producto_id = $2`,
        [existenciaTotal, id]
      );
    }
    await client.query('COMMIT');
    return updateRes.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProductoEstatus(id: number, estatus: 'A' | 'C'): Promise<Producto> {
  const { rows } = await query<Producto>(
    `UPDATE public.productos SET estatus = $1 WHERE producto_id = $2
     RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
               proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido,
               fecha_ultimo_inventario, estatus`,
    [estatus, id]
  );
  if (!rows[0]) throw new NotFoundError('Producto');
  return rows[0];
}

export interface AddStockDto {
  almacen_id: number;
  cantidad_a_sumar: number;
}

export async function addStockProducto(
  productoId: number,
  dto: { almacenes: AddStockDto[]; precio_venta_sugerido?: number }
): Promise<Producto> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (dto.precio_venta_sugerido !== undefined) {
      await client.query(
        `UPDATE public.productos SET precio_venta_sugerido = $1 WHERE producto_id = $2`,
        [dto.precio_venta_sugerido, productoId]
      );
    }

    for (const item of dto.almacenes || []) {
      const { almacen_id, cantidad_a_sumar } = item;
      if (cantidad_a_sumar <= 0) continue;

      const selectRes = await client.query<{ stock_actual: number }>(
        `SELECT stock_actual FROM public.producto_almacenes
         WHERE producto_id = $1 AND almacen_id = $2`,
        [productoId, almacen_id]
      );

      if (selectRes.rows[0]) {
        const actual = Number(selectRes.rows[0].stock_actual) || 0;
        const nuevoStock = actual + cantidad_a_sumar;
        await client.query(
          `UPDATE public.producto_almacenes SET stock_actual = $1
           WHERE producto_id = $2 AND almacen_id = $3`,
          [nuevoStock, productoId, almacen_id]
        );
      } else {
        await client.query(
          `INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
           VALUES ($1, $2, $3, 0, 0)`,
          [productoId, almacen_id, cantidad_a_sumar]
        );
      }
    }

    const sumRes = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(stock_actual), 0)::numeric as total
       FROM public.producto_almacenes WHERE producto_id = $1`,
      [productoId]
    );
    const existenciaTotal = Number(sumRes.rows[0]?.total ?? 0) || 0;
    await client.query(
      `UPDATE public.productos SET existencia_actual = $1, fecha_ultimo_inventario = now() WHERE producto_id = $2`,
      [existenciaTotal, productoId]
    );

    const selectRes = await client.query<Producto>(
      `SELECT p.producto_id, p.codigo_interno, p.descripcion, p.nombre, p.subcategoria_id,
              s.nombre as subcategoria_nombre, p.proveedor_id, pr.nombre_empresa as proveedor_nombre,
              p.existencia_actual, p.unidad_medida, p.precio_venta_sugerido,
              p.fecha_ultimo_inventario, COALESCE(p.estatus, 'A') as estatus
       FROM public.productos p
       LEFT JOIN public.subcategorias s ON s.subcategoria_id = p.subcategoria_id
       LEFT JOIN public.proveedores pr ON pr.proveedor_id = p.proveedor_id
       WHERE p.producto_id = $1`,
      [productoId]
    );
    const rows = selectRes.rows;
    await client.query('COMMIT');
    if (!rows[0]) throw new NotFoundError('Producto');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteProducto(id: number): Promise<void> {
  const checkRes = await query(
    `SELECT 1 FROM public.ventas_detalle WHERE producto_id = $1 LIMIT 1`,
    [id]
  );
  if (checkRes.rows.length > 0) {
    throw new AppError('No se puede eliminar el producto porque tiene ventas asociadas', 400);
  }
  await query(`DELETE FROM public.producto_almacenes WHERE producto_id = $1`, [id]);
  const { rows } = await query(
    `DELETE FROM public.productos
     WHERE producto_id = $1
     RETURNING producto_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Producto');
}
