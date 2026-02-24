"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usuariosService = __importStar(require("../services/usuarios.service"));
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
// Rutas /me deben ir antes de /:id para evitar que "me" se interprete como id
router.post('/me/change-password', auth_1.authenticateJWT, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Contraseña actual y nueva son requeridas' });
    }
    await usuariosService.changePassword(userId, currentPassword, newPassword);
    res.json({ success: true, message: 'Contraseña actualizada' });
});
router.get('/me', auth_1.authenticateJWT, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    const usuario = await usuariosService.getUsuarioById(userId);
    if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: usuario });
});
router.patch('/me', auth_1.authenticateJWT, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'No autenticado' });
    }
    const { username, email } = req.body;
    const dto = {};
    if (username !== undefined)
        dto.username = username;
    if (email !== undefined)
        dto.email = email;
    const usuario = await usuariosService.updateMiPerfil(userId, dto);
    res.json({ success: true, data: usuario });
});
router.get('/', auth_1.authenticateJWT, adminAuth_1.requireAdmin, async (_req, res) => {
    const data = await usuariosService.findAllUsuarios();
    res.json({ success: true, data });
});
router.post('/', auth_1.authenticateJWT, adminAuth_1.requireAdmin, async (req, res) => {
    const { username, email, password, rol } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({
            success: false,
            message: 'username, email y password son requeridos'
        });
    }
    const usuario = await usuariosService.createUsuario({ username, email, password, rol });
    res.status(201).json({ success: true, data: usuario });
});
router.get('/:id', auth_1.authenticateJWT, adminAuth_1.requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const usuario = await usuariosService.getUsuarioById(id);
    if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: usuario });
});
router.put('/:id', auth_1.authenticateJWT, adminAuth_1.requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { username, email, password, rol, activo } = req.body;
    const dto = {};
    if (username !== undefined)
        dto.username = username;
    if (email !== undefined)
        dto.email = email;
    if (password !== undefined)
        dto.password = password;
    if (rol === 'administrador' || rol === 'usuario')
        dto.rol = rol;
    if (typeof activo === 'boolean')
        dto.activo = activo;
    const usuario = await usuariosService.updateUsuario(id, dto);
    res.json({ success: true, data: usuario });
});
router.delete('/:id', auth_1.authenticateJWT, adminAuth_1.requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    await usuariosService.deleteUsuario(id);
    res.status(204).send();
});
exports.default = router;
