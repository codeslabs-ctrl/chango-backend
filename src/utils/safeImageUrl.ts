import { AppError } from './errors';

/**
 * Rechaza URLs que podrían usarse para SSRF (localhost, rangos privados, enlaces locales).
 */
export function assertPublicHttpUrl(urlStr: string): URL {
  let u: URL;
  try {
    u = new URL(urlStr.trim());
  } catch {
    throw new AppError('La URL de la imagen no es válida.', 400);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new AppError('Solo se permiten direcciones http o https.', 400);
  }
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new AppError('No se permiten URLs locales.', 400);
  }
  if (host === '0.0.0.0') {
    throw new AppError('No se permiten URLs locales.', 400);
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127 || a === 0 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      throw new AppError('No se permiten direcciones en redes privadas o loopback.', 400);
    }
  }

  if (host === '::1' || host === '0:0:0:0:0:0:0:1') {
    throw new AppError('No se permiten direcciones locales.', 400);
  }
  if (host.startsWith('[')) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === '::1' || inner.startsWith('fe80:') || inner.startsWith('fc') || inner.startsWith('fd')) {
      throw new AppError('No se permiten direcciones IPv6 locales.', 400);
    }
  }

  return u;
}
