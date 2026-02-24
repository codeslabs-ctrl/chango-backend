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
const subcategoriasService = __importStar(require("../services/subcategorias.service"));
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const categoriaId = req.query.categoriaId
        ? Number(req.query.categoriaId)
        : undefined;
    const data = await subcategoriasService.findAllSubcategorias(categoriaId);
    res.json({ success: true, data });
});
router.post('/', async (req, res) => {
    const { nombre, categoria_id } = req.body;
    if (!nombre || !categoria_id) {
        return res
            .status(400)
            .json({ success: false, message: 'nombre y categoria_id son obligatorios' });
    }
    const subcategoria = await subcategoriasService.createSubcategoria({
        nombre,
        categoria_id: Number(categoria_id)
    });
    res.status(201).json({ success: true, data: subcategoria });
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { nombre, categoria_id } = req.body;
    const subcategoria = await subcategoriasService.updateSubcategoria(id, {
        nombre,
        categoria_id: categoria_id ? Number(categoria_id) : undefined
    });
    res.json({ success: true, data: subcategoria });
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    await subcategoriasService.deleteSubcategoria(id);
    res.status(204).send();
});
exports.default = router;
