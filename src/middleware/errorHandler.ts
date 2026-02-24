import { NextFunction, Request, Response } from 'express';

// Error middleware centralizado
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(status).json({
    success: false,
    message
  });
}

