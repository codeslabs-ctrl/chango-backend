"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_CONFIG = exports.DB_CONFIG = exports.APP_PORT = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.APP_PORT = process.env.PORT ? Number(process.env.PORT) : 3005;
exports.DB_CONFIG = {
    host: process.env.DB_HOST || '69.164.244.24',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER || 'chango_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chango_db'
};
exports.JWT_CONFIG = {
    secret: process.env.JWT_SECRET || 'development-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
};
