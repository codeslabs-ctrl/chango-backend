"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllUsuarios = findAllUsuarios;
exports.getUsuarioById = getUsuarioById;
exports.createUsuario = createUsuario;
exports.updateUsuario = updateUsuario;
exports.updateMiPerfil = updateMiPerfil;
exports.changePassword = changePassword;
exports.deleteUsuario = deleteUsuario;
const db_1 = require("../config/db");
const password_1 = require("../utils/password");
const errors_1 = require("../utils/errors");
const ROLES = ['administrador', 'usuario'];
function validRol(rol) {
    return typeof rol === 'string' && ROLES.includes(rol);
}
async function findAllUsuarios() {
    const { rows } = await (0, db_1.query)(`SELECT id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion
     FROM public.usuarios
     ORDER BY id DESC`);
    return rows;
}
async function getUsuarioById(id) {
    const { rows } = await (0, db_1.query)(`SELECT id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion
     FROM public.usuarios
     WHERE id = $1`, [id]);
    return rows[0] || null;
}
async function createUsuario(dto) {
    const passwordHash = await (0, password_1.hashPassword)(dto.password);
    const rol = validRol(dto.rol) ? dto.rol : 'usuario';
    const { rows } = await (0, db_1.query)(`INSERT INTO public.usuarios (username, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, rol, activo, fecha_creacion`, [dto.username, dto.email, passwordHash, rol]);
    return rows[0];
}
async function updateUsuario(id, dto) {
    const existing = await getUsuarioById(id);
    if (!existing)
        throw new errors_1.NotFoundError('Usuario');
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (dto.username !== undefined) {
        updates.push(`username = $${paramIndex++}`);
        values.push(dto.username);
    }
    if (dto.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(dto.email);
    }
    if (dto.rol !== undefined && validRol(dto.rol)) {
        updates.push(`rol = $${paramIndex++}`);
        values.push(dto.rol);
    }
    if (dto.activo !== undefined) {
        updates.push(`activo = $${paramIndex++}`);
        values.push(dto.activo);
    }
    if (dto.password !== undefined && dto.password.trim()) {
        const hash = await (0, password_1.hashPassword)(dto.password);
        updates.push(`password_hash = $${paramIndex++}`);
        values.push(hash);
    }
    if (updates.length === 0)
        return existing;
    updates.push(`fecha_actualizacion = now()`);
    values.push(id);
    const setClause = updates.join(', ');
    const idParam = `$${paramIndex}`;
    const { rows } = await (0, db_1.query)(`UPDATE public.usuarios SET ${setClause} WHERE id = ${idParam}
     RETURNING id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion`, values);
    return rows[0];
}
async function updateMiPerfil(userId, dto) {
    const existing = await getUsuarioById(userId);
    if (!existing)
        throw new errors_1.NotFoundError('Usuario');
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (dto.username !== undefined) {
        updates.push(`username = $${paramIndex++}`);
        values.push(dto.username);
    }
    if (dto.email !== undefined) {
        updates.push(`email = $${paramIndex++}`);
        values.push(dto.email);
    }
    if (updates.length === 0)
        return existing;
    updates.push(`fecha_actualizacion = now()`);
    values.push(userId);
    const setClause = updates.join(', ');
    const idParam = `$${paramIndex}`;
    const { rows } = await (0, db_1.query)(`UPDATE public.usuarios SET ${setClause} WHERE id = ${idParam}
     RETURNING id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion`, values);
    return rows[0];
}
async function changePassword(userId, currentPassword, newPassword) {
    const { rows } = await (0, db_1.query)(`SELECT id, password_hash FROM public.usuarios WHERE id = $1`, [userId]);
    const user = rows[0];
    if (!user)
        throw new errors_1.NotFoundError('Usuario');
    const isValid = await (0, password_1.comparePassword)(currentPassword, user.password_hash);
    if (!isValid) {
        throw new errors_1.AppError('Contraseña actual incorrecta', 400);
    }
    const hash = await (0, password_1.hashPassword)(newPassword);
    await (0, db_1.query)(`UPDATE public.usuarios SET password_hash = $1, fecha_actualizacion = now() WHERE id = $2`, [hash, userId]);
}
async function deleteUsuario(id) {
    const usuario = await getUsuarioById(id);
    if (!usuario)
        throw new errors_1.NotFoundError('Usuario');
    if (usuario.rol === 'administrador') {
        throw new errors_1.AppError('No se puede eliminar un usuario con rol de administrador', 403);
    }
    const { rows } = await (0, db_1.query)(`DELETE FROM public.usuarios WHERE id = $1 RETURNING id`, [id]);
    if (!rows[0])
        throw new errors_1.NotFoundError('Usuario');
}
