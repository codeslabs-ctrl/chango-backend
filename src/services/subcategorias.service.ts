import { query } from '../config/db';
import type {
  Subcategoria,
  CreateSubcategoriaDto,
  UpdateSubcategoriaDto
} from '../models/subcategoria.model';
import { NotFoundError } from '../utils/errors';

export async function findAllSubcategorias(categoriaId?: number): Promise<Subcategoria[]> {
  const params: number[] = [];
  let where = '';

  if (categoriaId) {
    where = 'WHERE s.categoria_id = $1';
    params.push(categoriaId);
  }

  const { rows } = await query<Subcategoria>(
    `SELECT s.subcategoria_id,
            s.nombre,
            s.categoria_id,
            c.nombre as categoria_nombre
     FROM public.subcategorias s
     JOIN public.categorias c ON c.categoria_id = s.categoria_id
     ${where}
     ORDER BY c.nombre, s.nombre`,
    params
  );
  return rows;
}

export async function createSubcategoria(dto: CreateSubcategoriaDto): Promise<Subcategoria> {
  const { rows } = await query<Subcategoria>(
    `INSERT INTO public.subcategorias (nombre, categoria_id)
     VALUES ($1, $2)
     RETURNING subcategoria_id, nombre, categoria_id`,
    [dto.nombre, dto.categoria_id]
  );
  return rows[0];
}

export async function updateSubcategoria(
  id: number,
  dto: UpdateSubcategoriaDto
): Promise<Subcategoria> {
  const updates: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (dto.nombre !== undefined) {
    updates.push(`nombre = $${i++}`);
    params.push(dto.nombre);
  }
  if (dto.categoria_id !== undefined) {
    updates.push(`categoria_id = $${i++}`);
    params.push(dto.categoria_id);
  }
  if (updates.length === 0) {
    const { rows } = await query<Subcategoria>(
      `SELECT subcategoria_id, nombre, categoria_id FROM public.subcategorias WHERE subcategoria_id = $1`,
      [id]
    );
    if (!rows[0]) throw new NotFoundError('Subcategoría');
    return rows[0];
  }
  params.push(id);
  const { rows } = await query<Subcategoria>(
    `UPDATE public.subcategorias SET ${updates.join(', ')} WHERE subcategoria_id = $${i} RETURNING subcategoria_id, nombre, categoria_id`,
    params
  );
  if (!rows[0]) throw new NotFoundError('Subcategoría');
  return rows[0];
}

export async function deleteSubcategoria(id: number): Promise<void> {
  const { rows } = await query(
    `DELETE FROM public.subcategorias
     WHERE subcategoria_id = $1
     RETURNING subcategoria_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Subcategoría');
}
