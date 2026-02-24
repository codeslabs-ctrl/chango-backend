"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const db_1 = require("./config/db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check de la API y la base de datos
app.get('/health', async (_req, res) => {
    try {
        await db_1.pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'up' });
    }
    catch (error) {
        console.error('Error en health DB check:', error);
        res.status(500).json({ status: 'error', database: 'down' });
    }
});
app.use('/api', routes_1.default);
app.use(errorHandler_1.errorHandler);
exports.default = app;
