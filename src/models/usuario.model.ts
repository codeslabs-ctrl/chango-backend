export type RolUsuario = 'administrador' | 'usuario';

export interface Usuario {
  id: number;
  username: string;
  email: string;
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
}

export interface UpdateUsuarioDto {
  username?: string;
  email?: string;
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
  user: { id: number; username: string; email: string; rol: RolUsuario };
}
