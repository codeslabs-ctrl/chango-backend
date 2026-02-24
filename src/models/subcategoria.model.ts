export interface Subcategoria {
  subcategoria_id: number;
  nombre: string;
  categoria_id: number;
  categoria_nombre?: string;
}

export interface CreateSubcategoriaDto {
  nombre: string;
  categoria_id: number;
}

export interface UpdateSubcategoriaDto {
  nombre?: string;
  categoria_id?: number;
}
