"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
const jwt_1 = require("../utils/jwt");
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'No se proporcionó token' });
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ success: false, message: 'Formato de token inválido' });
    }
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = { id: payload.userId, username: payload.username, rol: payload.rol };
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
    }
}
