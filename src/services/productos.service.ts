import { pool, query } from '../config/db';
import type {
  Producto,
  CreateProductoDto,
  UpdateProductoDto,
  ProductoPrecioMetodo
} from '../models/producto.model';
import { AppError, NotFoundError } from '../utils/errors';
import * as productoImagenService from './producto-imagen.service';
import { normalizarTipoPago } from '../utils/metodosPago';

type DbClient = Pick<typeof pool, 'query'>;

export interface MetodoPagoCatalogoItem {
  metodo_id: number;
  tipo_pago: string;
}

function defaultPrecioMetodos(
  basePrice: number,
  metodos: MetodoPagoCatalogoItem[]
): { metodo_id: number; precio: number }[] {
  const byTipo = new Map(metodos.map(m => [normalizarTipoPago(m.tipo_pago), m.metodo_id]));
  const efectivoId = byTipo.get('efectivo');
  const pagoMovilId = byTipo.get('pago movil');
  const transferenciaId = byTipo.get('transferencia');
  const precioEfectivo = Math.max(0, Number(basePrice) || 0);
  const rows: { metodo_id: number; precio: number }[] = [];
  for (const m of metodos) {
    const tipo = normalizarTipoPago(m.tipo_pago);
    const precio =
      tipo === 'efectivo' || tipo === 'pago movil' || tipo === 'transferencia'
        ? precioEfectivo
        : 0;
    rows.push({ metodo_id: m.metodo_id, precio });
  }
  if (!efectivoId && pagoMovilId && transferenciaId) {
    // No-op de seguridad para no romper si faltan métodos esperados.
  }
  return rows;
}

async function upsertPrecioMetodoRows(
  client: DbClient,
  productoId: number,
  rows: { metodo_id: number; precio: number }[]
): Promise<void> {
  for (const r of rows) {
    await client.query(
      `INSERT INTO public.metodo_pago_producto (metodo_id, producto_id, precio)
       VALUES ($1, $2, $3)
       ON CONFLICT (metodo_id, producto_id)
       DO UPDATE SET precio = EXCLUDED.precio`,
      [r.metodo_id, productoId, Math.max(0, Number(r.precio) || 0)]
    );
  }
}

async function syncPrecioSugeridoConEfectivo(client: DbClient, productoId: number): Promise<void> {
  await client.query(
    `UPDATE public.productos p
     SET precio_venta_sugerido = COALESCE((
       SELECT mpp.precio
       FROM public.metodo_pago_producto mpp
       JOIN public.metodo_pago mp ON mp.metodo_id = mpp.metodo_id
       WHERE mpp.producto_id = p.producto_id
         AND LOWER(TRIM(mp.tipo_pago)) = 'efectivo'
       LIMIT 1
     ), p.precio_venta_sugerido)
     WHERE p.producto_id = $1`,
    [productoId]
  );
}

/** Vacío / ausente → 10; se permite 0 explícito. */
export function stockMinimoFromDto(a: Pick<{ stock_minimo?: number | null }, 'stock_minimo'>): number {
  const v = a.stock_minimo;
  if (v === undefined || v === null) return 10;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.floor(n));
}

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

export async function getMetodosPagoCatalogo(): Promise<MetodoPagoCatalogoItem[]> {
  const { rows } = await query<MetodoPagoCatalogoItem>(
    `SELECT metodo_id, tipo_pago
     FROM public.metodo_pago
     ORDER BY metodo_id ASC`
  );
  return rows;
}

export async function getProductoPreciosPorMetodo(productoId: number): Promise<ProductoPrecioMetodo[]> {
  const { rows } = await query<ProductoPrecioMetodo>(
    `SELECT mp.metodo_id,
            mp.tipo_pago,
            COALESCE(mpp.precio, 0)::numeric as precio
     FROM public.metodo_pago mp
     LEFT JOIN public.metodo_pago_producto mpp
       ON mpp.metodo_id = mp.metodo_id
      AND mpp.producto_id = $1
     ORDER BY mp.metodo_id`,
    [productoId]
  );
  return rows;
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
            p.costo,
            p.fecha_ultimo_inventario,
            COALESCE(p.estatus, 'A') as estatus,
            EXISTS(SELECT 1 FROM public.ventas_detalle vd WHERE vd.producto_id = p.producto_id) as tiene_ventas,
            p.imagen_url,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'metodo_id', mp.metodo_id,
                    'tipo_pago', mp.tipo_pago,
                    'precio', COALESCE(mpp.precio, 0)
                  )
                  ORDER BY mp.metodo_id
                ),
                '[]'::json
              )
              FROM public.metodo_pago mp
              LEFT JOIN public.metodo_pago_producto mpp
                ON mpp.metodo_id = mp.metodo_id
               AND mpp.producto_id = p.producto_id
            ) as precios_metodo
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
            p.costo,
            p.fecha_ultimo_inventario,
            COALESCE(p.estatus, 'A') as estatus,
            p.imagen_url,
            (
              SELECT COALESCE(
                json_agg(
                  json_build_object(
                    'metodo_id', mp.metodo_id,
                    'tipo_pago', mp.tipo_pago,
                    'precio', COALESCE(mpp.precio, 0)
                  )
                  ORDER BY mp.metodo_id
                ),
                '[]'::json
              )
              FROM public.metodo_pago mp
              LEFT JOIN public.metodo_pago_producto mpp
                ON mpp.metodo_id = mp.metodo_id
               AND mpp.producto_id = p.producto_id
            ) as precios_metodo
     FROM public.productos p
     LEFT JOIN public.subcategorias s ON s.subcategoria_id = p.subcategoria_id
     LEFT JOIN public.proveedores pr ON pr.proveedor_id = p.proveedor_id
     WHERE p.producto_id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function setProductoImagenDesdeUrl(productoId: number, sourceUrl: string): Promise<Producto> {
  const existing = await findProductoById(productoId);
  if (!existing) throw new NotFoundError('Producto');
  const publicPath = await productoImagenService.downloadAndStoreProductoImage(sourceUrl);
  await productoImagenService.removeProductoImageFile(existing.imagen_url ?? null);
  const { rows } = await query<Producto>(
    `UPDATE public.productos
     SET imagen_url = $1, fecha_ultimo_inventario = now()
     WHERE producto_id = $2
     RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
               proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido, costo,
               fecha_ultimo_inventario, COALESCE(estatus, 'A') as estatus, imagen_url`,
    [publicPath, productoId]
  );
  if (!rows[0]) throw new NotFoundError('Producto');
  return rows[0];
}

export async function setProductoImagenDesdeArchivo(productoId: number, fileBuffer: Buffer): Promise<Producto> {
  const existing = await findProductoById(productoId);
  if (!existing) throw new NotFoundError('Producto');
  const publicPath = await productoImagenService.validateAndStoreProductoImageBytes(fileBuffer);
  await productoImagenService.removeProductoImageFile(existing.imagen_url ?? null);
  const { rows } = await query<Producto>(
    `UPDATE public.productos
     SET imagen_url = $1, fecha_ultimo_inventario = now()
     WHERE producto_id = $2
     RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
               proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido, costo,
               fecha_ultimo_inventario, COALESCE(estatus, 'A') as estatus, imagen_url`,
    [publicPath, productoId]
  );
  if (!rows[0]) throw new NotFoundError('Producto');
  return rows[0];
}

export interface ProductoAlmacenInfo {
  almacen_id: number;
  almacen_nombre: string;
  stock_actual: number;
  stock_minimo?: number;
}

export async function getProductoAlmacenes(productoId: number): Promise<ProductoAlmacenInfo[]> {
  const { rows } = await query<ProductoAlmacenInfo>(
    `SELECT pa.almacen_id,
            a.nombre as almacen_nombre,
            pa.stock_actual,
            COALESCE(pa.stock_minimo, 0) as stock_minimo
     FROM public.producto_almacenes pa
     JOIN public.almacenes a ON a.almacen_id = pa.almacen_id
     WHERE pa.producto_id = $1
       AND COALESCE(a.estatus, 'A') = 'A'
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
          costo,
          estatus
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
                 proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido, costo,
                 fecha_ultimo_inventario, estatus, imagen_url`,
      [
        dto.codigo_interno,
        dto.descripcion,
        dto.nombre || null,
        dto.subcategoria_id ?? null,
        dto.proveedor_id ?? null,
        0,
        dto.unidad_medida || null,
        dto.precio_venta_sugerido ?? 0,
        dto.costo !== undefined && dto.costo !== null ? Math.max(0, Number(dto.costo)) : 0,
        dto.estatus || 'A'
      ]
    );
    const producto = insertRes.rows[0];
    const metodos = await getMetodosPagoCatalogo();
    const preciosMetodos = Array.isArray(dto.precios_metodo) && dto.precios_metodo.length > 0
      ? dto.precios_metodo
      : defaultPrecioMetodos(dto.precio_venta_sugerido ?? 0, metodos);
    await upsertPrecioMetodoRows(client, producto.producto_id, preciosMetodos);
    await syncPrecioSugeridoConEfectivo(client, producto.producto_id);
    const almacenes = dto.almacenes || [];
    await validarAlmacenesActivos(almacenes.map(a => a.almacen_id));
    let existenciaTotal = 0;
    for (const a of almacenes) {
      const stock = a.stock_actual ?? 0;
      const stockMin = stockMinimoFromDto(a);
      existenciaTotal += stock;
      await client.query(
        `INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
         VALUES ($1, $2, $3, $4, 0)`,
        [producto.producto_id, a.almacen_id, stock, stockMin]
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
    const costoSql =
      dto.costo !== undefined && dto.costo !== null
        ? Math.max(0, Number(dto.costo))
        : null;
    const updateRes = await client.query<Producto>(
      `UPDATE public.productos
       SET codigo_interno = $1,
           descripcion = $2,
           nombre = $3,
           subcategoria_id = $4,
           proveedor_id = $5,
           unidad_medida = $6,
           precio_venta_sugerido = $7,
           costo = COALESCE($8::numeric, costo),
           fecha_ultimo_inventario = now(),
           estatus = COALESCE($9::char, estatus, 'A')
       WHERE producto_id = $10
       RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
                 proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido, costo,
                 fecha_ultimo_inventario, COALESCE(estatus, 'A') as estatus, imagen_url`,
      [
        dto.codigo_interno ?? null,
        dto.descripcion ?? null,
        dto.nombre ?? null,
        dto.subcategoria_id ?? null,
        dto.proveedor_id ?? null,
        dto.unidad_medida ?? null,
        dto.precio_venta_sugerido ?? 0,
        costoSql,
        dto.estatus ?? null,
        id
      ]
    );
    if (!updateRes.rows[0]) throw new NotFoundError('Producto');
    if (Array.isArray(dto.precios_metodo)) {
      await upsertPrecioMetodoRows(client, id, dto.precios_metodo);
      await syncPrecioSugeridoConEfectivo(client, id);
    } else if (dto.precio_venta_sugerido !== undefined) {
      const metodos = await getMetodosPagoCatalogo();
      const byTipo = new Map(metodos.map(m => [normalizarTipoPago(m.tipo_pago), m.metodo_id]));
      const precio = Math.max(0, Number(dto.precio_venta_sugerido) || 0);
      const filas: { metodo_id: number; precio: number }[] = [];
      const efectivo = byTipo.get('efectivo');
      const pagoMovil = byTipo.get('pago movil');
      const transferencia = byTipo.get('transferencia');
      if (efectivo) filas.push({ metodo_id: efectivo, precio });
      if (pagoMovil) filas.push({ metodo_id: pagoMovil, precio });
      if (transferencia) filas.push({ metodo_id: transferencia, precio });
      await upsertPrecioMetodoRows(client, id, filas);
      await syncPrecioSugeridoConEfectivo(client, id);
    }
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
          if (a.stock_minimo !== undefined && a.stock_minimo !== null) {
            const sm = Math.max(0, Math.floor(Number(a.stock_minimo)));
            const stockMin = Number.isFinite(sm) ? sm : stockMinimoFromDto(a);
            await client.query(
              `UPDATE public.producto_almacenes
               SET stock_actual = $1, stock_minimo = $4
               WHERE producto_id = $2 AND almacen_id = $3`,
              [stock, id, a.almacen_id, stockMin]
            );
          } else {
            await client.query(
              `UPDATE public.producto_almacenes SET stock_actual = $1
               WHERE producto_id = $2 AND almacen_id = $3`,
              [stock, id, a.almacen_id]
            );
          }
        } else {
          const stockMin = stockMinimoFromDto(a);
          await client.query(
            `INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
             VALUES ($1, $2, $3, $4, 0)`,
            [id, a.almacen_id, stock, stockMin]
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
               proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido, costo,
               fecha_ultimo_inventario, estatus, imagen_url`,
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
      const nuevoPrecio = Math.max(0, Number(dto.precio_venta_sugerido) || 0);
      await client.query(
        `UPDATE public.productos SET precio_venta_sugerido = $1 WHERE producto_id = $2`,
        [nuevoPrecio, productoId]
      );
      const metodos = await getMetodosPagoCatalogo();
      const byTipo = new Map(metodos.map(m => [normalizarTipoPago(m.tipo_pago), m.metodo_id]));
      const filas: { metodo_id: number; precio: number }[] = [];
      const efectivo = byTipo.get('efectivo');
      const pagoMovil = byTipo.get('pago movil');
      const transferencia = byTipo.get('transferencia');
      if (efectivo) filas.push({ metodo_id: efectivo, precio: nuevoPrecio });
      if (pagoMovil) filas.push({ metodo_id: pagoMovil, precio: nuevoPrecio });
      if (transferencia) filas.push({ metodo_id: transferencia, precio: nuevoPrecio });
      await upsertPrecioMetodoRows(client, productoId, filas);
      await syncPrecioSugeridoConEfectivo(client, productoId);
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
           VALUES ($1, $2, $3, 10, 0)`,
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
              p.existencia_actual, p.unidad_medida, p.precio_venta_sugerido, p.costo,
              p.fecha_ultimo_inventario, COALESCE(p.estatus, 'A') as estatus, p.imagen_url
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
  const imgRes = await query<{ imagen_url: string | null }>(
    `SELECT imagen_url FROM public.productos WHERE producto_id = $1`,
    [id]
  );
  const oldUrl = imgRes.rows[0]?.imagen_url;
  await query(`DELETE FROM public.producto_almacenes WHERE producto_id = $1`, [id]);
  const { rows } = await query(
    `DELETE FROM public.productos
     WHERE producto_id = $1
     RETURNING producto_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Producto');
  await productoImagenService.removeProductoImageFile(oldUrl ?? null);
}

export async function getPrecioProductoPorTipoPago(
  productoId: number,
  tipoPago: string
): Promise<number | null> {
  const n = normalizarTipoPago(tipoPago);
  const { rows } = await query<{ precio: number }>(
    `SELECT mpp.precio
     FROM public.metodo_pago_producto mpp
     JOIN public.metodo_pago mp ON mp.metodo_id = mpp.metodo_id
     WHERE mpp.producto_id = $1
       AND LOWER(TRIM(mp.tipo_pago)) = LOWER(TRIM($2))
     LIMIT 1`,
    [productoId, n]
  );
  if (!rows[0]) return null;
  return Number(rows[0].precio) || 0;
}
