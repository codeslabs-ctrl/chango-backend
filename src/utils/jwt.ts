import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/env';

export interface JwtPayload {
  userId: number;
  username: string;
  rol?: string;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = {};

  if (JWT_CONFIG.expiresIn) {
    options.expiresIn = JWT_CONFIG.expiresIn as SignOptions['expiresIn'];
  }

  return jwt.sign(payload, JWT_CONFIG.secret as Secret, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_CONFIG.secret as Secret) as JwtPayload;
}

