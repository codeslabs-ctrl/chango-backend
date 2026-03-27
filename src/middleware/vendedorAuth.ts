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
