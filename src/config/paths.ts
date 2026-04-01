import path from 'path';

/** Raíz de archivos subidos (relativo al cwd del proceso, típicamente la carpeta `backend/`). */
export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

export const UPLOAD_PRODUCTOS_DIR = path.join(UPLOAD_ROOT, 'productos');

/** PrefijoURL pública servida por express.static */
export const UPLOAD_PUBLIC_PREFIX = '/uploads/productos';
