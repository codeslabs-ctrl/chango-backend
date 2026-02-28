import crypto from 'crypto';
import { query } from '../config/db';
import { comparePassword, hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { sendOtpEmail } from './email.service';
import type { UsuarioConPassword } from '../models/usuario.model';
import type { LoginDto, LoginResponse } from '../models/usuario.model';
import { AppError } from '../utils/errors';

export async function login(dto: LoginDto): Promise<LoginResponse> {
  const { rows } = await query<UsuarioConPassword & { first_login?: boolean }>(
    `SELECT id, username, email, rol, password_hash, activo, first_login
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
  const requiresPasswordChange = user.first_login === true;

  if (!requiresPasswordChange) {
    await query(
      `UPDATE public.usuarios SET ultimo_login = now(), intentos_fallidos = 0, first_login = false, fecha_actualizacion = now() WHERE id = $1`,
      [user.id]
    );
  } else {
    await query(
      `UPDATE public.usuarios SET ultimo_login = now(), intentos_fallidos = 0, fecha_actualizacion = now() WHERE id = $1`,
      [user.id]
    );
  }

  const result: LoginResponse & { requiresPasswordChange?: boolean } = {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      rol: user.rol || 'usuario'
    }
  };
  if (requiresPasswordChange) result.requiresPasswordChange = true;
  return result;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { rows } = await query<{ id: number; email: string }>(
    `SELECT id, email FROM public.usuarios WHERE LOWER(email) = LOWER($1) AND activo = true`,
    [email.trim()]
  );
  const user = rows[0];
  if (!user) {
    return;
  }
  const otp = crypto.randomInt(100000, 999999).toString();
  const hash = await hashPassword(otp);
  await query(
    `UPDATE public.usuarios SET password_hash = $1, first_login = true, token_recuperacion = NULL, token_expiracion = NULL, fecha_actualizacion = now() WHERE id = $2`,
    [hash, user.id]
  );
  await sendOtpEmail(user.email, otp);
}

