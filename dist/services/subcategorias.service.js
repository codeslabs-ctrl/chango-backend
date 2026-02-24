"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllSubcategorias = findAllSubcategorias;
exports.createSubcategoria = createSubcategoria;
exports.updateSubcategoria = updateSubcategoria;
exports.deleteSubcategoria = deleteSubcategoria;
const db_1 = require("../config/db");
const errors_1 = require("../utils/errors");
async function findAllSubcategorias(categoriaId) {
    const params = [];
    let where = '';
    if (categoriaId) {
        where = 'WHERE s.categoria_id = $1';
        params.push(categoriaId);
    }
    const { rows } = await (0, db_1.query)(`SELECT s.subcategoria_id,
            s.nombre,
            s.categoria_id,
            c.nombre as categoria_nombre
     FROM public.subcategorias s
     JOIN public.categorias c ON c.categoria_id = s.categoria_id
     ${where}
     ORDER BY c.nombre, s.nombre`, params);
    return rows;
}
async function createSubcategoria(dto) {
    const { rows } = await (0, db_1.query)(`INSERT INTO public.subcategorias (nombre, categoria_id)
     VALUES ($1, $2)
     RETURNING subcategoria_id, nombre, categoria_id`, [dto.nombre, dto.categoria_id]);
    return rows[0];
}
async function updateSubcategoria(id, dto) {
    const updates = [];
    const params = [];
    let i = 1;
    if (dto.nombre !== undefined) {
        updates.push(`nombre = $${i++}`);
        params.push(dto.nombre);
    }
    if (dto.categoria_id !== undefined) {
        updates.push(`categoria_id = $${i++}`);
        params.push(dto.categoria_id);
    }
    if (updates.length === 0) {
        const { rows } = await (0, db_1.query)(`SELECT subcategoria_id, nombre, categoria_id FROM public.subcategorias WHERE subcategoria_id = $1`, [id]);
        if (!rows[0])
            throw new errors_1.NotFoundError('Subcategoría');
        return rows[0];
    }
    params.push(id);
    const { rows } = await (0, db_1.query)(`UPDATE public.subcategorias SET ${updates.join(', ')} WHERE subcategoria_id = $${i} RETURNING subcategoria_id, nombre, categoria_id`, params);
    if (!rows[0])
        throw new errors_1.NotFoundError('Subcategoría');
    return rows[0];
}
async function deleteSubcategoria(id) {
    const { rows } = await (0, db_1.query)(`DELETE FROM public.subcategorias
     WHERE subcategoria_id = $1
     RETURNING subcategoria_id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Subcategoría');
}
