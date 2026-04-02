import { NextFunction, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthRequest } from '../types/auth';

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Falta el token de acceso. Iniciá sesión de nuevo.' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'El formato del token de acceso no es válido.' });
  }

  try {
    const payload = verifyToken(token);
    const rol = payload.rol === 'usuario' ? 'facturador' : payload.rol;
    req.user = { id: payload.userId, username: payload.username, rol };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'La sesión expiró o el token no es válido. Iniciá sesión de nuevo.' });
  }
}

