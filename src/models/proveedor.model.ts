export interface Proveedor {
  proveedor_id: number;
  nombre_empresa: string;
  rif_nit: string | null;
  telefono: string | null;
  contacto_nombre: string | null;
}

export interface CreateProveedorDto {
  nombre_empresa: string;
  rif_nit?: string;
  telefono?: string;
  contacto_nombre?: string;
}

export interface UpdateProveedorDto extends Partial<CreateProveedorDto> {}
