import { query } from '../config/db';
import { comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import type { UsuarioConPassword } from '../models/usuario.model';
import type { LoginDto, LoginResponse } from '../models/usuario.model';
import { AppError } from '../utils/errors';

export async function login(dto: LoginDto): Promise<LoginResponse> {
  const { rows } = await query<UsuarioConPassword>(
    `SELECT id, username, email, rol, password_hash, activo
     FROM public.usuarios
     WHERE username = $1 OR email = $1`,
    [dto.usernameOrEmail]
  );

  const user = rows[0];
  if (!user) {
    throw new AppError('Credenciales inválidas', 401);
  }

  if (!user.activo) {
    throw new AppError('Usuario inactivo', 403);
  }

  const isValid = await comparePassword(dto.password, user.password_hash);
  if (!isValid) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const token = signToken({ userId: user.id, username: user.username, rol: user.rol });

  await query(
    `UPDATE public.usuarios
     SET ultimo_login = now(), intentos_fallidos = 0, first_login = false, fecha_actualizacion = now()
     WHERE id = $1`,
    [user.id]
  );

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
