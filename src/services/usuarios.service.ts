import { query } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import type { Usuario, CreateUsuarioDto, UpdateUsuarioDto, RolUsuario } from '../models/usuario.model';
import { NotFoundError, AppError } from '../utils/errors';

const ROLES: RolUsuario[] = ['administrador', 'usuario', 'vendedor'];

function validRol(rol: unknown): rol is RolUsuario {
  return typeof rol === 'string' && ROLES.includes(rol as RolUsuario);
}

export async function findAllUsuarios(): Promise<Usuario[]> {
  const { rows } = await query<Usuario>(
    `SELECT id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion
     FROM public.usuarios
     ORDER BY id DESC`
  );
  return rows;
}

export async function getUsuarioById(id: number): Promise<Usuario | null> {
  const { rows } = await query<Usuario>(
    `SELECT id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion
     FROM public.usuarios
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUsuario(dto: CreateUsuarioDto): Promise<Usuario> {
  const passwordHash = await hashPassword(dto.password);
  const rol = validRol(dto.rol) ? dto.rol : 'usuario';

  const { rows } = await query<Usuario>(
    `INSERT INTO public.usuarios (username, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, rol, activo, fecha_creacion`,
    [dto.username, dto.email, passwordHash, rol]
  );

  return rows[0];
}

export async function updateUsuario(id: number, dto: UpdateUsuarioDto): Promise<Usuario> {
  const existing = await getUsuarioById(id);
  if (!existing) throw new NotFoundError('Usuario');

  const updates: string[] = [];
  const values: unknown[] = [];
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
    const hash = await hashPassword(dto.password);
    updates.push(`password_hash = $${paramIndex++}`);
    values.push(hash);
  }

  if (updates.length === 0) return existing;

  updates.push(`fecha_actualizacion = now()`);
  values.push(id);
  const setClause = updates.join(', ');
  const idParam = `$${paramIndex}`;

  const { rows } = await query<Usuario>(
    `UPDATE public.usuarios SET ${setClause} WHERE id = ${idParam}
     RETURNING id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion`,
    values
  );

  return rows[0];
}

export async function updateMiPerfil(userId: number, dto: { username?: string; email?: string }): Promise<Usuario> {
  const existing = await getUsuarioById(userId);
  if (!existing) throw new NotFoundError('Usuario');

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (dto.username !== undefined) {
    updates.push(`username = $${paramIndex++}`);
    values.push(dto.username);
  }
  if (dto.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    values.push(dto.email);
  }

  if (updates.length === 0) return existing;

  updates.push(`fecha_actualizacion = now()`);
  values.push(userId);
  const setClause = updates.join(', ');
  const idParam = `$${paramIndex}`;

  const { rows } = await query<Usuario>(
    `UPDATE public.usuarios SET ${setClause} WHERE id = ${idParam}
     RETURNING id, username, email, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion`,
    values
  );
  return rows[0];
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
  const { rows } = await query<{ id: number; password_hash: string }>(
    `SELECT id, password_hash FROM public.usuarios WHERE id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user) throw new NotFoundError('Usuario');

  const isValid = await comparePassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new AppError('Contraseña actual incorrecta', 400);
  }

  const hash = await hashPassword(newPassword);
  await query(
    `UPDATE public.usuarios SET password_hash = $1, first_login = false, fecha_actualizacion = now() WHERE id = $2`,
    [hash, userId]
  );
}

export async function deleteUsuario(id: number): Promise<void> {
  const usuario = await getUsuarioById(id);
  if (!usuario) throw new NotFoundError('Usuario');
  if (usuario.rol === 'administrador') {
    throw new AppError('No se puede eliminar un usuario con rol de administrador', 403);
  }
  const { rows } = await query(
    `DELETE FROM public.usuarios WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Usuario');
}
