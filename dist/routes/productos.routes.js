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
const productosService = __importStar(require("../services/productos.service"));
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
function parseAlmacenes(raw) {
    if (!Array.isArray(raw))
        return [];
    const result = [];
    for (const x of raw) {
        if (x && typeof x === 'object' && 'almacen_id' in x) {
            const id = Number(x.almacen_id);
            const stockRaw = x.stock_actual;
            const stock = typeof stockRaw === 'number' ? stockRaw : (typeof stockRaw === 'string' ? parseFloat(stockRaw) : 0);
            if (!isNaN(id)) {
                result.push({ almacen_id: id, stock_actual: isNaN(stock) ? 0 : Math.max(0, stock) });
            }
        }
    }
    return result;
}
router.get('/', async (req, res) => {
    const filters = {
        subcategoriaId: req.query.subcategoriaId
            ? Number(req.query.subcategoriaId)
            : undefined,
        proveedorId: req.query.proveedorId ? Number(req.query.proveedorId) : undefined,
        almacenId: req.query.almacenId ? Number(req.query.almacenId) : undefined
    };
    const data = await productosService.findAllProductos(filters);
    res.json({ success: true, data });
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const producto = await productosService.findProductoById(id);
    if (!producto) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    const almacenes = await productosService.getProductoAlmacenes(id);
    res.json({ success: true, data: { ...producto, almacenes } });
});
router.post('/', async (req, res) => {
    const { codigo_interno, descripcion, nombre, subcategoria_id, proveedor_id, unidad_medida, precio_venta_sugerido, almacenes, estatus } = req.body;
    if (!codigo_interno || !descripcion) {
        return res
            .status(400)
            .json({ success: false, message: 'codigo_interno y descripcion son obligatorios' });
    }
    const producto = await productosService.createProducto({
        codigo_interno,
        descripcion,
        nombre,
        subcategoria_id,
        proveedor_id,
        unidad_medida,
        precio_venta_sugerido,
        almacenes: parseAlmacenes(almacenes),
        estatus: estatus === 'C' ? 'C' : 'A'
    });
    res.status(201).json({ success: true, data: producto });
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { codigo_interno, descripcion, nombre, subcategoria_id, proveedor_id, unidad_medida, precio_venta_sugerido, almacenes, estatus } = req.body;
    const parsedAlmacenes = Array.isArray(almacenes) ? parseAlmacenes(almacenes) : undefined;
    const producto = await productosService.updateProducto(id, {
        codigo_interno,
        descripcion,
        nombre,
        subcategoria_id,
        proveedor_id,
        unidad_medida,
        precio_venta_sugerido,
        almacenes: parsedAlmacenes,
        estatus: estatus === 'C' ? 'C' : estatus === 'A' ? 'A' : undefined
    });
    res.json({ success: true, data: producto });
});
router.patch('/:id/estatus', async (req, res) => {
    const id = Number(req.params.id);
    const { estatus } = req.body;
    if (estatus !== 'A' && estatus !== 'C') {
        return res.status(400).json({ success: false, message: 'Estatus debe ser A o C' });
    }
    const producto = await productosService.updateProductoEstatus(id, estatus);
    res.json({ success: true, data: producto });
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        await productosService.deleteProducto(id);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errors_1.AppError && err.status === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        throw err;
    }
});
exports.default = router;
