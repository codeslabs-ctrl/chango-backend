export interface Categoria {
  categoria_id: number;
  nombre: string;
}

export interface CreateCategoriaDto {
  nombre: string;
}

export interface UpdateCategoriaDto {
  nombre: string;
}
