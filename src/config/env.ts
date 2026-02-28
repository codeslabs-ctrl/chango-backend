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

export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

export const SMTP_CONFIG = {
  service: process.env.EMAIL_SERVICE || '',
  host: process.env.EMAIL_HOST || process.env.SMTP_HOST || '',
  port: process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587),
  secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
  user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
  pass: process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || ''
};

