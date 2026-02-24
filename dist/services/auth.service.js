"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const db_1 = require("../config/db");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const errors_1 = require("../utils/errors");
async function login(dto) {
    const { rows } = await (0, db_1.query)(`SELECT id, username, email, rol, password_hash, activo
     FROM public.usuarios
     WHERE username = $1 OR email = $1`, [dto.usernameOrEmail]);
    const user = rows[0];
    if (!user) {
        throw new errors_1.AppError('Credenciales inválidas', 401);
    }
    if (!user.activo) {
        throw new errors_1.AppError('Usuario inactivo', 403);
    }
    const isValid = await (0, password_1.comparePassword)(dto.password, user.password_hash);
    if (!isValid) {
        throw new errors_1.AppError('Credenciales inválidas', 401);
    }
    const token = (0, jwt_1.signToken)({ userId: user.id, username: user.username, rol: user.rol });
    await (0, db_1.query)(`UPDATE public.usuarios
     SET ultimo_login = now(), intentos_fallidos = 0, first_login = false, fecha_actualizacion = now()
     WHERE id = $1`, [user.id]);
    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            rol: user.rol || 'usuario'
        }
    };
}
