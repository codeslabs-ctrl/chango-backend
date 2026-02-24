"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllProductos = findAllProductos;
exports.findProductoById = findProductoById;
exports.getProductoAlmacenes = getProductoAlmacenes;
exports.createProducto = createProducto;
exports.updateProducto = updateProducto;
exports.updateProductoEstatus = updateProductoEstatus;
exports.deleteProducto = deleteProducto;
const db_1 = require("../config/db");
const errors_1 = require("../utils/errors");
async function validarAlmacenesActivos(almacenIds) {
    if (almacenIds.length === 0)
        return;
    const { rows } = await (0, db_1.query)(`SELECT almacen_id, nombre FROM public.almacenes
     WHERE almacen_id = ANY($1) AND COALESCE(estatus, 'A') != 'A'`, [almacenIds]);
    if (rows.length > 0) {
        const nombres = rows.map(r => r.nombre).join(', ');
        throw new errors_1.AppError(`Solo se pueden asociar productos a almacenes activos. Los siguientes están inactivos: ${nombres}`, 400);
    }
}
async function findAllProductos(filters) {
    const params = [];
    const conditions = [];
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
    const { rows } = await (0, db_1.query)(`SELECT p.producto_id,
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
     ORDER BY p.producto_id DESC`, params);
    return rows;
}
async function findProductoById(id) {
    const { rows } = await (0, db_1.query)(`SELECT p.producto_id,
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
     WHERE p.producto_id = $1`, [id]);
    return rows[0] || null;
}
async function getProductoAlmacenes(productoId) {
    const { rows } = await (0, db_1.query)(`SELECT pa.almacen_id, a.nombre as almacen_nombre, pa.stock_actual
     FROM public.producto_almacenes pa
     JOIN public.almacenes a ON a.almacen_id = pa.almacen_id
     WHERE pa.producto_id = $1
     ORDER BY a.nombre`, [productoId]);
    return rows;
}
async function createProducto(dto) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const insertRes = await client.query(`INSERT INTO public.productos (
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
                 fecha_ultimo_inventario, estatus`, [
            dto.codigo_interno,
            dto.descripcion,
            dto.nombre || null,
            dto.subcategoria_id ?? null,
            dto.proveedor_id ?? null,
            0,
            dto.unidad_medida || null,
            dto.precio_venta_sugerido ?? 0,
            dto.estatus || 'A'
        ]);
        const producto = insertRes.rows[0];
        const almacenes = dto.almacenes || [];
        await validarAlmacenesActivos(almacenes.map(a => a.almacen_id));
        let existenciaTotal = 0;
        for (const a of almacenes) {
            const stock = a.stock_actual ?? 0;
            existenciaTotal += stock;
            await client.query(`INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
         VALUES ($1, $2, $3, 0, 0)`, [producto.producto_id, a.almacen_id, stock]);
        }
        await client.query(`UPDATE public.productos SET existencia_actual = $1 WHERE producto_id = $2`, [existenciaTotal, producto.producto_id]);
        await client.query('COMMIT');
        return producto;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function updateProducto(id, dto) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const updateRes = await client.query(`UPDATE public.productos
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
                 fecha_ultimo_inventario, COALESCE(estatus, 'A') as estatus`, [
            dto.codigo_interno ?? null,
            dto.descripcion ?? null,
            dto.nombre ?? null,
            dto.subcategoria_id ?? null,
            dto.proveedor_id ?? null,
            dto.unidad_medida ?? null,
            dto.precio_venta_sugerido ?? 0,
            dto.estatus ?? null,
            id
        ]);
        if (!updateRes.rows[0])
            throw new errors_1.NotFoundError('Producto');
        if (dto.almacenes !== undefined && Array.isArray(dto.almacenes)) {
            await validarAlmacenesActivos(dto.almacenes.map(a => a.almacen_id));
            const currentRes = await client.query(`SELECT almacen_id FROM public.producto_almacenes WHERE producto_id = $1`, [id]);
            const currentIds = new Set(currentRes.rows.map(r => r.almacen_id));
            const newIds = new Set(dto.almacenes.map(a => a.almacen_id));
            const toRemove = [...currentIds].filter(a => !newIds.has(a));
            for (const almacenId of toRemove) {
                await client.query(`DELETE FROM public.producto_almacenes WHERE producto_id = $1 AND almacen_id = $2`, [id, almacenId]);
            }
            let existenciaTotal = 0;
            for (const a of dto.almacenes) {
                const stock = a.stock_actual ?? 0;
                existenciaTotal += stock;
                const exists = currentIds.has(a.almacen_id);
                if (exists) {
                    await client.query(`UPDATE public.producto_almacenes SET stock_actual = $1
             WHERE producto_id = $2 AND almacen_id = $3`, [stock, id, a.almacen_id]);
                }
                else {
                    await client.query(`INSERT INTO public.producto_almacenes (producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden)
             VALUES ($1, $2, $3, 0, 0)`, [id, a.almacen_id, stock]);
                }
            }
            await client.query(`UPDATE public.productos SET existencia_actual = $1 WHERE producto_id = $2`, [existenciaTotal, id]);
        }
        await client.query('COMMIT');
        return updateRes.rows[0];
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function updateProductoEstatus(id, estatus) {
    const { rows } = await (0, db_1.query)(`UPDATE public.productos SET estatus = $1 WHERE producto_id = $2
     RETURNING producto_id, codigo_interno, descripcion, nombre, subcategoria_id,
               proveedor_id, existencia_actual, unidad_medida, precio_venta_sugerido,
               fecha_ultimo_inventario, estatus`, [estatus, id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Producto');
    return rows[0];
}
async function deleteProducto(id) {
    const checkRes = await (0, db_1.query)(`SELECT 1 FROM public.ventas_detalle WHERE producto_id = $1 LIMIT 1`, [id]);
    if (checkRes.rows.length > 0) {
        throw new errors_1.AppError('No se puede eliminar el producto porque tiene ventas asociadas', 400);
    }
    await (0, db_1.query)(`DELETE FROM public.producto_almacenes WHERE producto_id = $1`, [id]);
    const { rows } = await (0, db_1.query)(`DELETE FROM public.productos
     WHERE producto_id = $1
     RETURNING producto_id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Producto');
}
