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
const proveedoresService = __importStar(require("../services/proveedores.service"));
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const data = await proveedoresService.findAllProveedores();
    res.json({ success: true, data });
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const proveedor = await proveedoresService.findProveedorById(id);
    if (!proveedor) {
        return res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
    }
    res.json({ success: true, data: proveedor });
});
router.post('/', async (req, res) => {
    const { nombre_empresa, rif_nit, telefono, contacto_nombre } = req.body;
    if (!nombre_empresa) {
        return res
            .status(400)
            .json({ success: false, message: 'El nombre de la empresa es obligatorio' });
    }
    const proveedor = await proveedoresService.createProveedor({
        nombre_empresa,
        rif_nit,
        telefono,
        contacto_nombre
    });
    res.status(201).json({ success: true, data: proveedor });
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { nombre_empresa, rif_nit, telefono, contacto_nombre } = req.body;
    const proveedor = await proveedoresService.updateProveedor(id, {
        nombre_empresa,
        rif_nit,
        telefono,
        contacto_nombre
    });
    res.json({ success: true, data: proveedor });
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    await proveedoresService.deleteProveedor(id);
    res.status(204).send();
});
exports.default = router;
