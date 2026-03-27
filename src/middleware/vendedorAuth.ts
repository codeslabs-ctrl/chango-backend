import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';

/** Bloquea usuarios con rol vendedor (solo ventas y clientes en la UI). */
export function requireNotVendedor(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.rol === 'vendedor') {
    return res.status(403).json({
      success: false,
      message: 'Tu usuario no tiene permiso para esta acción. Solo podés usar ventas y clientes.'
    });
  }
  next();
}

/** Solo rol vendedor (p. ej. estadísticas propias). */
export function requireVendedor(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.rol !== 'vendedor') {
    return res.status(403).json({
      success: false,
      message: 'Esta acción está reservada para usuarios con rol vendedor.'
    });
  }
  next();
}
