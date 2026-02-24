import { query } from '../config/db';
import type { Cliente, CreateClienteDto, UpdateClienteDto } from '../models/cliente.model';
import { NotFoundError } from '../utils/errors';

export async function findAllClientes(): Promise<Cliente[]> {
  const { rows } = await query<Cliente>(
    `SELECT cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro
     FROM public.clientes
     ORDER BY cliente_id DESC`
  );
  return rows;
}

export async function findClienteById(id: number): Promise<Cliente | null> {
  const { rows } = await query<Cliente>(
    `SELECT cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro
     FROM public.clientes
     WHERE cliente_id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createCliente(dto: CreateClienteDto): Promise<Cliente> {
  const { rows } = await query<Cliente>(
    `INSERT INTO public.clientes (nombre, cedula_rif, telefono, email, direccion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro`,
    [dto.nombre, dto.cedula_rif || null, dto.telefono || null, dto.email || null, dto.direccion || null]
  );
  return rows[0];
}

export async function updateCliente(id: number, dto: UpdateClienteDto): Promise<Cliente> {
  const { rows } = await query<Cliente>(
    `UPDATE public.clientes
     SET nombre = $1,
         cedula_rif = $2,
         telefono = $3,
         email = $4,
         direccion = $5
     WHERE cliente_id = $6
     RETURNING cliente_id, nombre, cedula_rif, telefono, email, direccion, fecha_registro`,
    [
      dto.nombre ?? null,
      dto.cedula_rif ?? null,
      dto.telefono ?? null,
      dto.email ?? null,
      dto.direccion ?? null,
      id
    ]
  );
  if (!rows[0]) throw new NotFoundError('Cliente');
  return rows[0];
}

export async function deleteCliente(id: number): Promise<void> {
  const { rows } = await query(
    `DELETE FROM public.clientes
     WHERE cliente_id = $1
     RETURNING cliente_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Cliente');
}
