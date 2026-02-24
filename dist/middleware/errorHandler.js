"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
// Error middleware centralizado
function errorHandler(err, _req, res, _next) {
    console.error(err);
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';
    res.status(status).json({
        success: false,
        message
    });
}
