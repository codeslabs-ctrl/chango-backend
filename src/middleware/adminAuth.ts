import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.rol !== 'administrador') {
    return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}
