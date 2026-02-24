import { query } from '../config/db';
import type {
  Proveedor,
  CreateProveedorDto,
  UpdateProveedorDto
} from '../models/proveedor.model';
import { NotFoundError } from '../utils/errors';

export async function findAllProveedores(): Promise<Proveedor[]> {
  const { rows } = await query<Proveedor>(
    `SELECT proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre
     FROM public.proveedores
     ORDER BY nombre_empresa`
  );
  return rows;
}

export async function findProveedorById(id: number): Promise<Proveedor | null> {
  const { rows } = await query<Proveedor>(
    `SELECT proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre
     FROM public.proveedores
     WHERE proveedor_id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function createProveedor(dto: CreateProveedorDto): Promise<Proveedor> {
  const { rows } = await query<Proveedor>(
    `INSERT INTO public.proveedores (nombre_empresa, rif_nit, telefono, contacto_nombre)
     VALUES ($1, $2, $3, $4)
     RETURNING proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre`,
    [
      dto.nombre_empresa,
      dto.rif_nit || null,
      dto.telefono || null,
      dto.contacto_nombre || null
    ]
  );
  return rows[0];
}

export async function updateProveedor(id: number, dto: UpdateProveedorDto): Promise<Proveedor> {
  const { rows } = await query<Proveedor>(
    `UPDATE public.proveedores
     SET nombre_empresa = $1,
         rif_nit = $2,
         telefono = $3,
         contacto_nombre = $4
     WHERE proveedor_id = $5
     RETURNING proveedor_id, nombre_empresa, rif_nit, telefono, contacto_nombre`,
    [
      dto.nombre_empresa ?? null,
      dto.rif_nit ?? null,
      dto.telefono ?? null,
      dto.contacto_nombre ?? null,
      id
    ]
  );
  if (!rows[0]) throw new NotFoundError('Proveedor');
  return rows[0];
}

export async function deleteProveedor(id: number): Promise<void> {
  const { rows } = await query(
    `DELETE FROM public.proveedores
     WHERE proveedor_id = $1
     RETURNING proveedor_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Proveedor');
}
