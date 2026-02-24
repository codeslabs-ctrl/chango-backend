"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
async function start() {
    try {
        // Probar conexión a DB al iniciar
        await db_1.pool.query('SELECT 1');
        console.log('Conectado a PostgreSQL correctamente');
        app_1.default.listen(env_1.APP_PORT, () => {
            console.log(`Servidor escuchando en http://localhost:${env_1.APP_PORT}`);
        });
    }
    catch (error) {
        console.error('Error al iniciar la aplicación:', error);
        process.exit(1);
    }
}
start();
