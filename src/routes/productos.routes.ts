import { Router } from 'express';
import * as productosService from '../services/productos.service';
import { AppError } from '../utils/errors';

const router = Router();

function parseAlmacenes(raw: unknown): { almacen_id: number; stock_actual: number }[] {
  if (!Array.isArray(raw)) return [];
  const result: { almacen_id: number; stock_actual: number }[] = [];
  for (const x of raw) {
    if (x && typeof x === 'object' && 'almacen_id' in x) {
      const id = Number((x as { almacen_id: unknown }).almacen_id);
      const stockRaw = (x as { stock_actual?: unknown }).stock_actual;
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
  const {
    codigo_interno,
    descripcion,
    nombre,
    subcategoria_id,
    proveedor_id,
    unidad_medida,
    precio_venta_sugerido,
    almacenes,
    estatus
  } = req.body;

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
  const {
    codigo_interno,
    descripcion,
    nombre,
    subcategoria_id,
    proveedor_id,
    unidad_medida,
    precio_venta_sugerido,
    almacenes,
    estatus
  } = req.body;

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
  } catch (err) {
    if (err instanceof AppError && err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    throw err;
  }
});

export default router;
