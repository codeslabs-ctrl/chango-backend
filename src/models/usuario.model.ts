export type RolUsuario = 'administrador' | 'usuario' | 'vendedor';

export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombre_usuario?: string | null;
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
}

export interface UpdateUsuarioDto {
  username?: string;
  email?: string;
  nombre_usuario?: string | null;
  password?: string;
  rol?: RolUsuario;
  activo?: boolean;
}

export interface LoginDto {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: { id: number; username: string; email: string; nombre_usuario?: string | null; rol: RolUsuario };
}
