"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllAlmacenes = findAllAlmacenes;
exports.createAlmacen = createAlmacen;
exports.updateAlmacen = updateAlmacen;
exports.updateAlmacenEstatus = updateAlmacenEstatus;
exports.deleteAlmacen = deleteAlmacen;
exports.getProductosByAlmacen = getProductosByAlmacen;
exports.upsertStockProductoAlmacen = upsertStockProductoAlmacen;
const db_1 = require("../config/db");
const errors_1 = require("../utils/errors");
async function findAllAlmacenes() {
    const { rows } = await (0, db_1.query)(`SELECT almacen_id, nombre, ubicacion,
            COALESCE(estatus, 'A') as estatus,
            EXISTS(SELECT 1 FROM public.producto_almacenes pa WHERE pa.almacen_id = almacenes.almacen_id) as tiene_productos
     FROM public.almacenes
     ORDER BY nombre`);
    return rows;
}
async function createAlmacen(dto) {
    const { rows } = await (0, db_1.query)(`INSERT INTO public.almacenes (nombre, ubicacion, estatus)
     VALUES ($1, $2, $3)
     RETURNING almacen_id, nombre, ubicacion, estatus`, [dto.nombre, dto.ubicacion || null, dto.estatus || 'A']);
    return rows[0];
}
async function updateAlmacen(id, dto) {
    const updates = [];
    const params = [];
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
        const existing = await (0, db_1.query)(`SELECT almacen_id, nombre, ubicacion, COALESCE(estatus, 'A') as estatus FROM public.almacenes WHERE almacen_id = $1`, [id]);
        if (!existing.rows[0])
            throw new errors_1.NotFoundError('Almacén');
        return existing.rows[0];
    }
    params.push(id);
    const { rows } = await (0, db_1.query)(`UPDATE public.almacenes SET ${updates.join(', ')} WHERE almacen_id = $${i}
     RETURNING almacen_id, nombre, ubicacion, COALESCE(estatus, 'A') as estatus`, params);
    if (!rows[0])
        throw new errors_1.NotFoundError('Almacén');
    return rows[0];
}
async function updateAlmacenEstatus(id, estatus) {
    const { rows } = await (0, db_1.query)(`UPDATE public.almacenes SET estatus = $1 WHERE almacen_id = $2
     RETURNING almacen_id, nombre, ubicacion, estatus`, [estatus, id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Almacén');
    return rows[0];
}
async function deleteAlmacen(id) {
    const checkRes = await (0, db_1.query)(`SELECT 1 FROM public.producto_almacenes WHERE almacen_id = $1 LIMIT 1`, [id]);
    if (checkRes.rows.length > 0) {
        throw new errors_1.AppError('No se puede eliminar el almacén porque tiene productos asociados', 400);
    }
    const { rows } = await (0, db_1.query)(`DELETE FROM public.almacenes
     WHERE almacen_id = $1
     RETURNING almacen_id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Almacén');
}
async function getProductosByAlmacen(almacenId) {
    const { rows } = await (0, db_1.query)(`SELECT pa.producto_almacen_id,
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
     ORDER BY p.descripcion`, [almacenId]);
    return rows;
}
async function upsertStockProductoAlmacen(almacenId, productoId, dto) {
    const almacenRes = await (0, db_1.query)(`SELECT COALESCE(estatus, 'A') as estatus FROM public.almacenes WHERE almacen_id = $1`, [almacenId]);
    if (!almacenRes.rows[0])
        throw new errors_1.NotFoundError('Almacén');
    if (almacenRes.rows[0].estatus !== 'A') {
        throw new errors_1.AppError('Solo se pueden asociar productos a almacenes con estatus activo', 400);
    }
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        const selectRes = await client.query(`SELECT producto_almacen_id
       FROM public.producto_almacenes
       WHERE producto_id = $1 AND almacen_id = $2`, [productoId, almacenId]);
        let row;
        const stockActual = dto.stock_actual ?? 0;
        const stockMinimo = dto.stock_minimo ?? 0;
        const puntoReorden = dto.punto_reorden ?? 0;
        if (selectRes.rows[0]) {
            const updateRes = await client.query(`UPDATE public.producto_almacenes
         SET stock_actual = $1,
             stock_minimo = $2,
             punto_reorden = $3
         WHERE producto_id = $4 AND almacen_id = $5
         RETURNING producto_almacen_id, producto_id, almacen_id,
                   stock_actual, stock_minimo, punto_reorden`, [stockActual, stockMinimo, puntoReorden, productoId, almacenId]);
            row = updateRes.rows[0];
        }
        else {
            const insertRes = await client.query(`INSERT INTO public.producto_almacenes (
           producto_id, almacen_id, stock_actual, stock_minimo, punto_reorden
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING producto_almacen_id, producto_id, almacen_id,
                   stock_actual, stock_minimo, punto_reorden`, [productoId, almacenId, stockActual, stockMinimo, puntoReorden]);
            row = insertRes.rows[0];
        }
        const sumRes = await client.query(`SELECT COALESCE(SUM(stock_actual), 0)::text as total
       FROM public.producto_almacenes
       WHERE producto_id = $1`, [productoId]);
        const existenciaTotal = parseInt(sumRes.rows[0]?.total ?? '0', 10);
        await client.query(`UPDATE public.productos SET existencia_actual = $1 WHERE producto_id = $2`, [existenciaTotal, productoId]);
        await client.query('COMMIT');
        return row;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
