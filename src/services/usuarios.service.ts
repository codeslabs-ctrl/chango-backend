import { query } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import type { Usuario, CreateUsuarioDto, UpdateUsuarioDto, RolUsuario } from '../models/usuario.model';
import { NotFoundError, AppError } from '../utils/errors';

const ROLES: RolUsuario[] = ['administrador', 'facturador', 'vendedor'];

function validRol(rol: unknown): rol is RolUsuario {
  return typeof rol === 'string' && ROLES.includes(rol as RolUsuario);
}

function normalizarPorcentajeComision(raw: unknown, rol: RolUsuario): number {
  if (rol !== 'vendedor') return 0;
  if (raw === undefined || raw === null || raw === '') return 0;
  const n =
    typeof raw === 'string' ? parseFloat(String(raw).replace(',', '.')) : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new AppError('El porcentaje de comisión debe ser un número entre 0 y 100.', 400);
  }
  return Math.round(n * 100) / 100;
}

export async function findAllUsuarios(): Promise<Usuario[]> {
  const { rows } = await query<Usuario>(
    `SELECT id, username, email, nombre_usuario, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion,
            COALESCE(porcentaje_comision, 0) AS porcentaje_comision
     FROM public.usuarios
     ORDER BY id DESC`
  );
  return rows;
}

export async function getUsuarioById(id: number): Promise<Usuario | null> {
  const { rows } = await query<Usuario>(
    `SELECT id, username, email, nombre_usuario, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion,
            COALESCE(porcentaje_comision, 0) AS porcentaje_comision
     FROM public.usuarios
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUsuario(dto: CreateUsuarioDto): Promise<Usuario> {
  const passwordHash = await hashPassword(dto.password);
  const rol = validRol(dto.rol) ? dto.rol : 'facturador';
  const nombreUsuario =
    dto.nombre_usuario !== undefined && dto.nombre_usuario !== null && String(dto.nombre_usuario).trim() !== ''
      ? String(dto.nombre_usuario).trim().slice(0, 200)
      : String(dto.username).trim().slice(0, 200);
  const pct = normalizarPorcentajeComision(dto.porcentaje_comision, rol);

  const { rows } = await query<Usuario>(
    `INSERT INTO public.usuarios (username, email, password_hash, rol, nombre_usuario, porcentaje_comision)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, email, nombre_usuario, rol, activo, fecha_creacion,
               COALESCE(porcentaje_comision, 0) AS porcentaje_comision`,
    [dto.username, dto.email, passwordHash, rol, nombreUsuario, pct]
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
  if (dto.nombre_usuario !== undefined) {
    const n =
      dto.nombre_usuario === null || String(dto.nombre_usuario).trim() === ''
        ? null
        : String(dto.nombre_usuario).trim().slice(0, 200);
    updates.push(`nombre_usuario = $${paramIndex++}`);
    values.push(n);
  }
  if (dto.rol !== undefined && validRol(dto.rol)) {
    updates.push(`rol = $${paramIndex++}`);
    values.push(dto.rol);
  }
  const rolEfectivo: RolUsuario =
    dto.rol !== undefined && validRol(dto.rol) ? dto.rol : existing.rol;
  if (dto.porcentaje_comision !== undefined) {
    const pct = normalizarPorcentajeComision(dto.porcentaje_comision, rolEfectivo);
    updates.push(`porcentaje_comision = $${paramIndex++}`);
    values.push(pct);
  } else if (dto.rol !== undefined && validRol(dto.rol) && dto.rol !== 'vendedor') {
    updates.push(`porcentaje_comision = $${paramIndex++}`);
    values.push(0);
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
     RETURNING id, username, email, nombre_usuario, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion,
               COALESCE(porcentaje_comision, 0) AS porcentaje_comision`,
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
     RETURNING id, username, email, nombre_usuario, rol, activo, ultimo_login, fecha_creacion, fecha_actualizacion,
               COALESCE(porcentaje_comision, 0) AS porcentaje_comision`,
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
