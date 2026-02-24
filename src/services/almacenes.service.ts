import { pool, query } from '../config/db';
import type {
  Almacen,
  ProductoAlmacen,
  CreateAlmacenDto,
  UpdateAlmacenDto,
  UpdateStockDto
} from '../models/almacen.model';
import { AppError, NotFoundError } from '../utils/errors';

export async function findAllAlmacenes(): Promise<Almacen[]> {
  const { rows } = await query<Almacen>(
    `SELECT almacen_id, nombre, ubicacion,
            COALESCE(estatus, 'A') as estatus,
            EXISTS(SELECT 1 FROM public.producto_almacenes pa WHERE pa.almacen_id = almacenes.almacen_id) as tiene_productos
     FROM public.almacenes
     ORDER BY nombre`
  );
  return rows;
}

export async function createAlmacen(dto: CreateAlmacenDto): Promise<Almacen> {
  const { rows } = await query<Almacen>(
    `INSERT INTO public.almacenes (nombre, ubicacion, estatus)
     VALUES ($1, $2, $3)
     RETURNING almacen_id, nombre, ubicacion, estatus`,
    [dto.nombre, dto.ubicacion || null, dto.estatus || 'A']
  );
  return rows[0];
}

export async function updateAlmacen(id: number, dto: UpdateAlmacenDto): Promise<Almacen> {
  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  let i = 1;
  if (dto.nombre !== undefined) {
    updates.push(`nombre = $${i++}`);
    params.push(dto.nombre);
  }
  if (dto.ubicacion !== undefined) {
    updates.push(`ubicacion = $${i++}`);
    params.push(dto.ubicacion);
  }
  if (dto.estatus !== undefined) {
    updates.push(`estatus = $${i++}`);
    params.push(dto.estatus);
  }
  if (updates.length === 0) {
    const existing = await query<Almacen>(
      `SELECT almacen_id, nombre, ubicacion, COALESCE(estatus, 'A') as estatus FROM public.almacenes WHERE almacen_id = $1`,
      [id]
    );
    if (!existing.rows[0]) throw new NotFoundError('Almacén');
    return existing.rows[0];
  }
  params.push(id);
  const { rows } = await query<Almacen>(
    `UPDATE public.almacenes SET ${updates.join(', ')} WHERE almacen_id = $${i}
     RETURNING almacen_id, nombre, ubicacion, COALESCE(estatus, 'A') as estatus`,
    params
  );
  if (!rows[0]) throw new NotFoundError('Almacén');
  return rows[0];
}

export async function updateAlmacenEstatus(id: number, estatus: 'A' | 'C'): Promise<Almacen> {
  const { rows } = await query<Almacen>(
    `UPDATE public.almacenes SET estatus = $1 WHERE almacen_id = $2
     RETURNING almacen_id, nombre, ubicacion, estatus`,
    [estatus, id]
  );
  if (!rows[0]) throw new NotFoundError('Almacén');
  return rows[0];
}

export async function deleteAlmacen(id: number): Promise<void> {
  const checkRes = await query(
    `SELECT 1 FROM public.producto_almacenes WHERE almacen_id = $1 LIMIT 1`,
    [id]
  );
  if (checkRes.rows.length > 0) {
    throw new AppError('No se puede eliminar el almacén porque tiene productos asociados', 400);
  }
  const { rows } = await query(
    `DELETE FROM public.almacenes
     WHERE almacen_id = $1
     RETURNING almacen_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Almacén');
}

export async function getProductosByAlmacen(almacenId: number): Promise<ProductoAlmacen[]> {
  const { rows } = await query<ProductoAlmacen>(
    `SELECT pa.producto_almacen_id,
            pa.producto_id,
            p.codigo_interno,
            p.descripcion,
            p.nombre as producto_nombre,
            pa.almacen_id,
            a.nombre as almacen_nombre,
            pa.stock_actual,
            pa.stock_minimo,
            pa.punto_reorden
     FROM public.producto_almacenes pa
     JOIN public.productos p ON p.producto_id = pa.producto_id
     JOIN public.almacenes a ON a.almacen_id = pa.almacen_id
     WHERE pa.almacen_id = $1
     ORDER BY p.descripcion`,
    [almacenId]
  );
  return rows;
}

export async function upsertStockProductoAlmacen(
  almacenId: number,
  productoId: number,
  dto: UpdateStockDto
): Promise<ProductoAlmacen> {
  const almacenRes = await query<{ estatus: string }>(
    `SELECT COALESCE(estatus, 'A') as estatus FROM public.almacenes WHERE almacen_id = $1`,
    [almacenId]
  );
  if (!almacenRes.rows[0]) throw new NotFoundError('Almacén');
  if (almacenRes.rows[0].estatus !== 'A') {
    throw new AppError('Solo se pueden asociar productos a almacenes con estatus activo', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const selectRes = await client.query(
      `SELECT producto_almacen_id
       FROM public.producto_almacenes
       WHERE producto_id = $1 AND almacen_id = $2`,
      [productoId, almacenId]
    );

    let row: ProductoAlmacen;
    const stockActual = dto.stock_actual ?? 0;
    const stockMinimo = dto.stock_minimo ?? 0;
    const puntoReorden = dto.punto_reorden ?? 0;

    if (selectRes.rows[0]) {
      const updateRes = await client.query<ProductoAlmacen>(
        `UPDATE public.producto_almacenes
         SET stock_actual = $1,
             stock_minimo = $2,
             punto_reorden = $3
         WHERE producto_id = $4 AND almacen_id = $5
         RETURNING producto_almacen_id, producto_id, almacen_id,
                   stock_actual, stock_minimo, punto_reorden`,
        [stockActual, stockMinimo, puntoReorden, productoId, almacenId]
      );
      row = updateRes.rows[0];
    } else {
      const insertRes = await client.query<ProductoAlmacen>(
        `INSERT INTO public.producto_almacenes (
           producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING producto_almacen_id, producto_id, almacen_id,
                   stock_actual, stock_minimo, punto_reorden`,
        [productoId, almacenId, stockActual, stockMinimo, puntoReorden]
      );
      row = insertRes.rows[0];
    }

    const sumRes = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(stock_actual), 0)::text as total
       FROM public.producto_almacenes
       WHERE producto_id = $1`,
      [productoId]
    );
    const existenciaTotal = parseInt(sumRes.rows[0]?.total ?? '0', 10);
    await client.query(
      `UPDATE public.productos SET existencia_actual = $1 WHERE producto_id = $2`,
      [existenciaTotal, productoId]
    );

    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
