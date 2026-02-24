"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllCategorias = findAllCategorias;
exports.createCategoria = createCategoria;
exports.updateCategoria = updateCategoria;
exports.deleteCategoria = deleteCategoria;
const db_1 = require("../config/db");
const errors_1 = require("../utils/errors");
async function findAllCategorias() {
    const { rows } = await (0, db_1.query)(`SELECT categoria_id, nombre
     FROM public.categorias
     ORDER BY nombre`);
    return rows;
}
async function createCategoria(dto) {
    const { rows } = await (0, db_1.query)(`INSERT INTO public.categorias (nombre)
     VALUES ($1)
     RETURNING categoria_id, nombre`, [dto.nombre]);
    return rows[0];
}
async function updateCategoria(id, dto) {
    const { rows } = await (0, db_1.query)(`UPDATE public.categorias
     SET nombre = $1
     WHERE categoria_id = $2
     RETURNING categoria_id, nombre`, [dto.nombre, id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Categoría');
    return rows[0];
}
async function deleteCategoria(id) {
    await (0, db_1.query)(`UPDATE public.productos SET subcategoria_id = NULL
     WHERE subcategoria_id IN (SELECT subcategoria_id FROM public.subcategorias WHERE categoria_id = $1)`, [id]);
    await (0, db_1.query)(`DELETE FROM public.subcategorias WHERE categoria_id = $1`, [id]);
    const { rows } = await (0, db_1.query)(`DELETE FROM public.categorias
     WHERE categoria_id = $1
     RETURNING categoria_id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Categoría');
}
