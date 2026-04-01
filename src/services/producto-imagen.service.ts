import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_MAX_IMAGE_BYTES } from '../config/env';
import { UPLOAD_PRODUCTOS_DIR, UPLOAD_PUBLIC_PREFIX } from '../config/paths';
import { AppError } from '../utils/errors';
import { assertPublicHttpUrl } from '../utils/safeImageUrl';

type ImageExt = 'jpg' | 'png' | 'gif' | 'webp';

function detectImageType(buf: Buffer): ImageExt | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 6 && buf.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

async function fetchBinaryWithLimit(url: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Chango-ProductImage/1.0' }
  });
  if (!res.ok) {
    throw new AppError(`No se pudo descargar la imagen (código ${res.status}).`, 400);
  }
  const cl = res.headers.get('content-length');
  if (cl != null && Number(cl) > maxBytes) {
    throw new AppError('La imagen supera el tamaño máximo permitido.', 400);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new AppError('La respuesta del servidor no tiene contenido.', 400);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.length) {
      total += value.length;
      if (total > maxBytes) {
        throw new AppError('La imagen supera el tamaño máximo permitido.', 400);
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Valida tipo y tamaño, guarda en disco y devuelve la ruta pública (p. ej. `/uploads/productos/abc.jpg`).
 */
export async function validateAndStoreProductoImageBytes(buf: Buffer): Promise<string> {
  if (buf.length === 0) {
    throw new AppError('El archivo está vacío.', 400);
  }
  if (buf.length > UPLOAD_MAX_IMAGE_BYTES) {
    throw new AppError('La imagen supera el tamaño máximo permitido.', 400);
  }
  const kind = detectImageType(buf);
  if (!kind) {
    throw new AppError('El archivo no es una imagen válida (JPEG, PNG, GIF o WebP).', 400);
  }
  await fs.mkdir(UPLOAD_PRODUCTOS_DIR, { recursive: true });
  const fileName = `${crypto.randomBytes(12).toString('hex')}.${kind}`;
  const absPath = path.join(UPLOAD_PRODUCTOS_DIR, fileName);
  await fs.writeFile(absPath, buf);
  return `${UPLOAD_PUBLIC_PREFIX}/${fileName}`;
}

function localPathFromPublicUrl(imagenUrl: string | null | undefined): string | null {
  if (!imagenUrl || !imagenUrl.startsWith(UPLOAD_PUBLIC_PREFIX + '/')) return null;
  const name = path.basename(imagenUrl);
  if (!name || name.includes('..')) return null;
  return path.join(UPLOAD_PRODUCTOS_DIR, name);
}

export async function removeProductoImageFile(imagenUrl: string | null | undefined): Promise<void> {
  const abs = localPathFromPublicUrl(imagenUrl);
  if (!abs) return;
  try {
    await fs.unlink(abs);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code !== 'ENOENT') throw e;
  }
}

/**
 * Descarga una imagen desde una URL pública, valida tipo y tamaño, guarda en disco
 * y devuelve la ruta pública (p. ej. `/uploads/productos/abc.jpg`).
 */
export async function downloadAndStoreProductoImage(sourceUrl: string): Promise<string> {
  const safe = assertPublicHttpUrl(sourceUrl).toString();
  const buf = await fetchBinaryWithLimit(safe, UPLOAD_MAX_IMAGE_BYTES);
  return validateAndStoreProductoImageBytes(buf);
}
