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
const almacenesService = __importStar(require("../services/almacenes.service"));
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const data = await almacenesService.findAllAlmacenes();
    res.json({ success: true, data });
});
router.post('/', async (req, res) => {
    const { nombre, ubicacion, estatus } = req.body;
    if (!nombre) {
        return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    }
    const almacen = await almacenesService.createAlmacen({
        nombre,
        ubicacion,
        estatus: estatus === 'C' ? 'C' : 'A'
    });
    res.status(201).json({ success: true, data: almacen });
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { nombre, ubicacion, estatus } = req.body;
    const dto = {};
    if (nombre !== undefined)
        dto.nombre = nombre;
    if (ubicacion !== undefined)
        dto.ubicacion = ubicacion;
    if (estatus === 'A' || estatus === 'C')
        dto.estatus = estatus;
    const almacen = await almacenesService.updateAlmacen(id, dto);
    res.json({ success: true, data: almacen });
});
router.patch('/:id/estatus', async (req, res) => {
    const id = Number(req.params.id);
    const { estatus } = req.body;
    if (estatus !== 'A' && estatus !== 'C') {
        return res.status(400).json({ success: false, message: 'Estatus debe ser A o C' });
    }
    const almacen = await almacenesService.updateAlmacenEstatus(id, estatus);
    res.json({ success: true, data: almacen });
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        await almacenesService.deleteAlmacen(id);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errors_1.AppError && err.status === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        throw err;
    }
});
router.get('/:almacenId/productos', async (req, res) => {
    const almacenId = Number(req.params.almacenId);
    const data = await almacenesService.getProductosByAlmacen(almacenId);
    res.json({ success: true, data });
});
router.post('/:almacenId/productos/:productoId', async (req, res) => {
    const almacenId = Number(req.params.almacenId);
    const productoId = Number(req.params.productoId);
    const { stock_actual, stock_minimo, punto_reorden } = req.body;
    const data = await almacenesService.upsertStockProductoAlmacen(almacenId, productoId, { stock_actual, stock_minimo, punto_reorden });
    res.json({ success: true, data });
});
exports.default = router;
