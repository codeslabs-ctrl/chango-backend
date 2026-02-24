export interface Cliente {
  cliente_id: number;
  nombre: string;
  cedula_rif: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  fecha_registro: Date;
}

export interface CreateClienteDto {
  nombre: string;
  cedula_rif?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

export interface UpdateClienteDto extends Partial<CreateClienteDto> {}
