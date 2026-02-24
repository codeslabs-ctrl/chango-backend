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
const ventasService = __importStar(require("../services/ventas.service"));
const router = (0, express_1.Router)();
// Rutas específicas primero (antes de /:id genérico)
router.patch('/:id/confirmar', async (req, res) => {
    const id = Number(req.params.id);
    const data = await ventasService.confirmarVenta(id);
    if (!data) {
        return res.status(404).json({ success: false, message: 'Venta no encontrada o ya confirmada' });
    }
    res.json({ success: true, data });
});
router.patch('/:id/eliminar', async (req, res) => {
    const id = Number(req.params.id);
    const data = await ventasService.eliminarVenta(id);
    if (!data) {
        return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }
    res.json({ success: true, data });
});
router.post('/', async (req, res) => {
    const { cliente_id, metodo_pago, detalles, confirmar } = req.body;
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
        return res
            .status(400)
            .json({ success: false, message: 'La venta debe tener al menos un detalle' });
    }
    if (confirmar && !(metodo_pago || '').toString().trim()) {
        return res
            .status(400)
            .json({ success: false, message: 'El método de pago es obligatorio al confirmar la venta' });
    }
    const result = await ventasService.crearVenta({
        cliente_id,
        metodo_pago,
        detalles,
        confirmar: !!confirmar
    });
    res.status(201).json({ success: true, data: result });
});
router.get('/', async (req, res) => {
    const filters = {
        clienteId: req.query.clienteId ? Number(req.query.clienteId) : undefined,
        estatus: req.query.estatus
    };
    const data = await ventasService.findAllVentas(filters);
    res.json({ success: true, data });
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const data = await ventasService.findVentaById(id);
    if (!data) {
        return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }
    res.json({ success: true, data });
});
exports.default = router;
