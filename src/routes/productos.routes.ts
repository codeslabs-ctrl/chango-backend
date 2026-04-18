import { Router, type Request, type Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import * as productosService from '../services/productos.service';
import { UPLOAD_MAX_IMAGE_BYTES } from '../config/env';
import { AppError, NotFoundError } from '../utils/errors';
import { authenticateJWT } from '../middleware/auth';
import { requireNotVendedor } from '../middleware/vendedorAuth';

const router = Router();

const productoImagenUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_IMAGE_BYTES },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ok =
      !mime ||
      mime === 'image/jpeg' ||
      mime === 'image/jpg' ||
      mime === 'image/pjpeg' ||
      mime === 'image/png' ||
      mime === 'image/gif' ||
      mime === 'image/webp';
    if (ok) cb(null, true);
    else cb(new AppError('Solo se permiten imágenes JPEG, PNG, GIF o WebP.', 400));
  }
});

function parseAlmacenes(raw: unknown): {
  almacen_id: number;
  stock_actual: number;
  stock_minimo?: number;
}[] {
  if (!Array.isArray(raw)) return [];
  const result: { almacen_id: number; stock_actual: number; stock_minimo?: number }[] = [];
  for (const x of raw) {
    if (x && typeof x === 'object' && 'almacen_id' in x) {
      const id = Number((x as { almacen_id: unknown }).almacen_id);
      const stockRaw = (x as { stock_actual?: unknown }).stock_actual;
      const stock = typeof stockRaw === 'number' ? stockRaw : typeof stockRaw === 'string' ? parseFloat(stockRaw) : 0;
      if (!isNaN(id)) {
        const row: { almacen_id: number; stock_actual: number; stock_minimo?: number } = {
          almacen_id: id,
          stock_actual: isNaN(stock) ? 0 : Math.max(0, stock)
        };
        if ('stock_minimo' in x) {
          const smRaw = (x as { stock_minimo?: unknown }).stock_minimo;
          if (smRaw !== undefined && smRaw !== null && smRaw !== '') {
            const sm = typeof smRaw === 'number' ? smRaw : parseFloat(String(smRaw));
            if (!isNaN(sm)) row.stock_minimo = Math.max(0, Math.floor(sm));
          }
        }
        result.push(row);
      }
    }
  }
  return result;
}

function parsePreciosMetodo(raw: unknown): { metodo_id: number; precio: number }[] {
  if (!Array.isArray(raw)) return [];
  const result: { metodo_id: number; precio: number }[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const metodoIdRaw = (x as { metodo_id?: unknown }).metodo_id;
    const precioRaw = (x as { precio?: unknown }).precio;
    const metodo_id = Number(metodoIdRaw);
    const precio = Number(precioRaw);
    if (!Number.isFinite(metodo_id) || metodo_id < 1) continue;
    if (!Number.isFinite(precio) || precio < 0) continue;
    result.push({ metodo_id, precio });
  }
  return result;
}

router.get('/metodos-pago', async (_req, res) => {
  const data = await productosService.getMetodosPagoCatalogo();
  res.json({ success: true, data });
});

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

router.get('/:id/precios-metodo', async (req, res) => {
  const id = Number(req.params.id);
  const data = await productosService.getProductoPreciosPorMetodo(id);
  res.json({ success: true, data });
});

router.post('/:id/imagen-desde-url', authenticateJWT, requireNotVendedor, async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id) || id < 1) {
    return res.status(400).json({ success: false, message: 'ID de producto inválido.' });
  }
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!url) {
    return res.status(400).json({ success: false, message: 'Indicá la URL de la imagen.' });
  }
  try {
    const producto = await productosService.setProductoImagenDesdeUrl(id, url);
    res.json({ success: true, data: producto });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.status).json({ success: false, message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ success: false, message: err.message });
    throw err;
  }
});

router.post(
  '/:id/imagen',
  authenticateJWT,
  requireNotVendedor,
  productoImagenUpload.single('imagen'),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'ID de producto inválido.' });
    }
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ success: false, message: 'Enviá un archivo de imagen en el campo "imagen".' });
    }
    try {
      const producto = await productosService.setProductoImagenDesdeArchivo(id, file.buffer);
      res.json({ success: true, data: producto });
    } catch (err) {
      if (err instanceof AppError) return res.status(err.status).json({ success: false, message: err.message });
      throw err;
    }
  }
);

router.post('/', authenticateJWT, requireNotVendedor, async (req, res) => {
  const {
    codigo_interno,
    descripcion,
    nombre,
    subcategoria_id,
    proveedor_id,
    unidad_medida,
    precio_venta_sugerido,
    costo,
    almacenes,
    precios_metodo,
    estatus
  } = req.body;

  if (!codigo_interno || !descripcion) {
    return res
      .status(400)
      .json({ success: false, message: 'El código interno y la descripción son obligatorios.' });
  }

  const producto = await productosService.createProducto({
    codigo_interno,
    descripcion,
    nombre,
    subcategoria_id,
    proveedor_id,
    unidad_medida,
    precio_venta_sugerido,
    costo: costo !== undefined && costo !== null ? Number(costo) : undefined,
    almacenes: parseAlmacenes(almacenes),
    precios_metodo: parsePreciosMetodo(precios_metodo),
    estatus: estatus === 'C' ? 'C' : 'A'
  });
  res.status(201).json({ success: true, data: producto });
});

router.put('/:id', authenticateJWT, requireNotVendedor, async (req, res) => {
  const id = Number(req.params.id);
  const {
    codigo_interno,
    descripcion,
    nombre,
    subcategoria_id,
    proveedor_id,
    unidad_medida,
    precio_venta_sugerido,
    costo,
    almacenes,
    precios_metodo,
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
    costo: costo !== undefined && costo !== null ? Number(costo) : undefined,
    almacenes: parsedAlmacenes,
    precios_metodo: Array.isArray(precios_metodo) ? parsePreciosMetodo(precios_metodo) : undefined,
    estatus: estatus === 'C' ? 'C' : estatus === 'A' ? 'A' : undefined
  });
  res.json({ success: true, data: producto });
});

router.post('/:id/stock', authenticateJWT, requireNotVendedor, async (req, res) => {
  const id = Number(req.params.id);
  const { almacenes, precio_venta_sugerido } = req.body;
  if (!Array.isArray(almacenes)) {
    return res.status(400).json({ success: false, message: 'almacenes debe ser un array' });
  }
  const parsed = almacenes
    .filter((a: unknown) => a && typeof a === 'object' && 'almacen_id' in a && 'cantidad_a_sumar' in a)
    .map((a: { almacen_id: unknown; cantidad_a_sumar: unknown }) => ({
      almacen_id: Number((a as { almacen_id: unknown }).almacen_id),
      cantidad_a_sumar: Math.max(0, Number((a as { cantidad_a_sumar: unknown }).cantidad_a_sumar) || 0)
    }))
    .filter(a => !isNaN(a.almacen_id) && a.cantidad_a_sumar > 0);
  if (parsed.length === 0 && precio_venta_sugerido === undefined) {
    return res.status(400).json({ success: false, message: 'Debe indicar al menos un almacén con cantidad a sumar o un precio' });
  }
  try {
    const producto = await productosService.addStockProducto(id, {
      almacenes: parsed,
      precio_venta_sugerido: typeof precio_venta_sugerido === 'number' ? precio_venta_sugerido : undefined
    });
    res.json({ success: true, data: producto });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.status).json({ success: false, message: err.message });
    if (err instanceof NotFoundError) return res.status(404).json({ success: false, message: err.message });
    throw err;
  }
});

router.patch('/:id/estatus', authenticateJWT, requireNotVendedor, async (req, res) => {
  const id = Number(req.params.id);
  const { estatus } = req.body;
  if (estatus !== 'A' && estatus !== 'C') {
    return res.status(400).json({ success: false, message: 'El estado debe ser A (activo) o C (cerrado).' });
  }
  const producto = await productosService.updateProductoEstatus(id, estatus);
  res.json({ success: true, data: producto });
});

router.delete('/:id', authenticateJWT, requireNotVendedor, async (req, res) => {
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
