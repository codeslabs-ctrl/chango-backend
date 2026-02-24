import { query } from '../config/db';
import type { Categoria, CreateCategoriaDto, UpdateCategoriaDto } from '../models/categoria.model';
import { NotFoundError } from '../utils/errors';

export async function findAllCategorias(): Promise<Categoria[]> {
  const { rows } = await query<Categoria>(
    `SELECT categoria_id, nombre
     FROM public.categorias
     ORDER BY nombre`
  );
  return rows;
}

export async function createCategoria(dto: CreateCategoriaDto): Promise<Categoria> {
  const { rows } = await query<Categoria>(
    `INSERT INTO public.categorias (nombre)
     VALUES ($1)
     RETURNING categoria_id, nombre`,
    [dto.nombre]
  );
  return rows[0];
}

export async function updateCategoria(id: number, dto: UpdateCategoriaDto): Promise<Categoria> {
  const { rows } = await query<Categoria>(
    `UPDATE public.categorias
     SET nombre = $1
     WHERE categoria_id = $2
     RETURNING categoria_id, nombre`,
    [dto.nombre, id]
  );
  if (!rows[0]) throw new NotFoundError('Categoría');
  return rows[0];
}

export async function deleteCategoria(id: number): Promise<void> {
  await query(
    `UPDATE public.productos SET subcategoria_id = NULL
     WHERE subcategoria_id IN (SELECT subcategoria_id FROM public.subcategorias WHERE categoria_id = $1)`,
    [id]
  );
  await query(`DELETE FROM public.subcategorias WHERE categoria_id = $1`, [id]);
  const { rows } = await query(
    `DELETE FROM public.categorias
     WHERE categoria_id = $1
     RETURNING categoria_id`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Categoría');
}
