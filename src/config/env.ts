import dotenv from 'dotenv';

dotenv.config();

export const APP_PORT = process.env.PORT ? Number(process.env.PORT) : 3005;

export const DB_CONFIG = {
  host: process.env.DB_HOST || '69.164.244.24',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER || 'chango_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chango_db'
};

export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'development-secret-change-me',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h'
};

