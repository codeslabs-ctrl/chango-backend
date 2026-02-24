"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(resource) {
        super(`${resource} no encontrado`, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
