"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllClientes = findAllClientes;
exports.findClienteById = findClienteById;
exports.createCliente = createCliente;
exports.updateCliente = updateCliente;
exports.deleteCliente = deleteCliente;
const db_1 = require("../config/db");
const errors_1 = require("../utils/errors");
async function findAllClientes() {
    const { rows } = await (0, db_1.query)(`SELECT cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro
     FROM public.clientes
     ORDER BY cliente_id DESC`);
    return rows;
}
async function findClienteById(id) {
    const { rows } = await (0, db_1.query)(`SELECT cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro
     FROM public.clientes
     WHERE cliente_id = $1`, [id]);
    return rows[0] || null;
}
async function createCliente(dto) {
    const { rows } = await (0, db_1.query)(`INSERT INTO public.clientes (nombre, cedula_rif, telefono, email, direccion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro`, [dto.nombre, dto.cedula_rif || null, dto.telefono || null, dto.email || null, dto.direccion || null]);
    return rows[0];
}
async function updateCliente(id, dto) {
    const { rows } = await (0, db_1.query)(`UPDATE public.clientes
     SET nombre = $1,
         cedula_rif = $2,
         telefono = $3,
         email = $4,
         direccion = $5
     WHERE cliente_id = $6
     RETURNING cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro`, [
        dto.nombre ?? null,
        dto.cedula_rif ?? null,
        dto.telefono ?? null,
        dto.email ?? null,
        dto.direccion ?? null,
        id
    ]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Cliente');
    return rows[0];
}
async function deleteCliente(id) {
    const { rows } = await (0, db_1.query)(`DELETE FROM public.clientes
     WHERE cliente_id = $1
     RETURNING cliente_id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Cliente');
}
