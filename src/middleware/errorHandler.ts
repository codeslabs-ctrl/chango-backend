import { NextFunction, Request, Response } from 'express';
import { mapErrorForClient } from '../utils/mapErrorForClient';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  const { status, message } = mapErrorForClient(err);
  res.status(status).json({
    success: false,
    message
  });
}
