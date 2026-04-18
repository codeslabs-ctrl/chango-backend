import { MulterError } from 'multer';
import { AppError } from './errors';

/** Mensajes claros en español para respuestas JSON (sin exponer detalles técnicos en inglés). */
export function mapErrorForClient(err: unknown): { status: number; message: string } {
  if (err instanceof AppError) {
    return { status: err.status, message: err.message };
  }

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return { status: 400, message: 'La imagen supera el tamaño máximo permitido.' };
    }
    return { status: 400, message: 'No se pudo procesar el archivo enviado.' };
  }

  if (isPostgresError(err)) {
    return mapPostgresError(err);
  }

  const e = err as { status?: number; statusCode?: number; type?: string; message?: string };

  if (e.type === 'entity.parse.failed' || e.type === 'entity.too.large') {
    return {
      status: 400,
      message: 'La petición no tiene un formato válido. Revisá los datos enviados.'
    };
  }

  const status =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : 500;

  if (status >= 400 && status < 500 && e.message && typeof e.message === 'string') {
    return { status, message: e.message };
  }

  return {
    status: 500,
    message: 'Ocurrió un error en el servidor. Probá de nuevo más tarde.'
  };
}

/** SQLSTATE de PostgreSQL: 5 caracteres alfanuméricos (p. ej. 23505, 42P01). */
function isPostgresError(err: unknown): err is { code: string; constraint?: string; message?: string } {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/i.test(code);
}

function mapPostgresError(err: { code: string; constraint?: string; message?: string }): {
  status: number;
  message: string;
} {
  switch (err.code) {
    case '23505':
      return {
        status: 409,
        message:
          'Ya existe un registro con esos datos. Revisá que no esté duplicado (por ejemplo usuario, correo o código).'
      };
    case '23514': {
      const c = err.constraint || '';
      const msg = err.message || '';
      if (c.includes('rol') || msg.includes('usuarios_rol_check')) {
        return {
          status: 400,
          message:
            'El rol elegido no está permitido todavía. Pedí al administrador que actualice la base de datos o elegí otro rol.'
        };
      }
      return {
        status: 400,
        message: 'Los datos no cumplen las reglas guardadas. Revisá los valores ingresados.'
      };
    }
    case '23503':
      return {
        status: 400,
        message:
          'No se puede guardar porque hay una referencia a otro dato que no existe o no coincide.'
      };
    case '23502':
      return {
        status: 400,
        message: 'Falta un dato obligatorio.'
      };
    case '22P02':
      return {
        status: 400,
        message: 'El formato de uno de los datos no es válido.'
      };
    case '42P01':
      return {
        status: 503,
        message:
          'Falta una tabla en la base de datos (por ejemplo ventas_detalle_despacho). Reiniciá el servidor backend para aplicar el esquema o ejecutá scripts/migrar-ventas-despacho.sql en PostgreSQL.'
      };
    case '42703':
      return {
        status: 503,
        message:
          'Faltan columnas en la base de datos (por ejemplo comisiones en ventas). Ejecutá el script scripts/add-comisiones-vendedor.sql en PostgreSQL y reiniciá el servidor.'
      };
    default:
      return {
        status: 500,
        message:
          'Ocurrió un error al guardar en la base de datos. Probá de nuevo o contactá al administrador.'
      };
  }
}
