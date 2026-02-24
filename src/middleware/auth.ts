import { NextFunction, Response } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthRequest } from '../types/auth';

export function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No se proporcionó token' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Formato de token inválido' });
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.userId, username: payload.username, rol: payload.rol };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

