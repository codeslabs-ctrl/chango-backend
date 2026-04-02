export type RolUsuario = 'administrador' | 'facturador' | 'vendedor';

export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre_usuario?: string | null;
  /** Porcentaje 0–100; aplica a ventas del vendedor. */
  porcentaje_comision?: number | string | null;
  rol: RolUsuario;
  activo: boolean;
  ultimo_login?: Date | null;
  fecha_creacion?: Date;
  fecha_actualizacion?: Date;
}

export interface UsuarioConPassword extends Usuario {
  password_hash: string;
}

export interface CreateUsuarioDto {
  username: string;
  email: string;
  password: string;
  rol?: RolUsuario;
  nombre_usuario?: string | null;
  porcentaje_comision?: number | null;
}

export interface UpdateUsuarioDto {
  username?: string;
  email?: string;
  nombre_usuario?: string | null;
  password?: string;
  rol?: RolUsuario;
  activo?: boolean;
  porcentaje_comision?: number | null;
}

export interface LoginDto {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: { id: number; username: string; email: string; nombre_usuario?: string | null; rol: RolUsuario };
}
