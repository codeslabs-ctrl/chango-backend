"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllProveedores = findAllProveedores;
exports.findProveedorById = findProveedorById;
exports.createProveedor = createProveedor;
exports.updateProveedor = updateProveedor;
exports.deleteProveedor = deleteProveedor;
const db_1 = require("../config/db");
const errors_1 = require("../utils/errors");
async function findAllProveedores() {
    const { rows } = await (0, db_1.query)(`SELECT proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre
     FROM public.proveedores
     ORDER BY nombre_empresa`);
    return rows;
}
async function findProveedorById(id) {
    const { rows } = await (0, db_1.query)(`SELECT proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre
     FROM public.proveedores
     WHERE proveedor_id = $1`, [id]);
    return rows[0] || null;
}
async function createProveedor(dto) {
    const { rows } = await (0, db_1.query)(`INSERT INTO public.proveedores (nombre_empresa, rif_nit, telefono, contacto_nombre)
     VALUES ($1, $2, $3, $4)
     RETURNING proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre`, [
        dto.nombre_empresa,
        dto.rif_nit || null,
        dto.telefono || null,
        dto.contacto_nombre || null
    ]);
    return rows[0];
}
async function updateProveedor(id, dto) {
    const { rows } = await (0, db_1.query)(`UPDATE public.proveedores
     SET nombre_empresa = $1,
         rif_nit = $2,
         telefono = $3,
         contacto_nombre = $4
     WHERE proveedor_id = $5
     RETURNING proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre`, [
        dto.nombre_empresa ?? null,
        dto.rif_nit ?? null,
        dto.telefono ?? null,
        dto.contacto_nombre ?? null,
        id
    ]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Proveedor');
    return rows[0];
}
async function deleteProveedor(id) {
    const { rows } = await (0, db_1.query)(`DELETE FROM public.proveedores
     WHERE proveedor_id = $1
     RETURNING proveedor_id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Proveedor');
}
