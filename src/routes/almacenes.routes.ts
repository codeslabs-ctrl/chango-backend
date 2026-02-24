import { Router } from 'express';
import * as almacenesService from '../services/almacenes.service';
import { AppError } from '../utils/errors';

const router = Router();

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

  const dto: { nombre?: string; ubicacion?: string; estatus?: 'A' | 'C' } = {};
  if (nombre !== undefined) dto.nombre = nombre;
  if (ubicacion !== undefined) dto.ubicacion = ubicacion;
  if (estatus === 'A' || estatus === 'C') dto.estatus = estatus;

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
  } catch (err) {
    if (err instanceof AppError && err.status === 400) {
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

  const data = await almacenesService.upsertStockProductoAlmacen(
    almacenId,
    productoId,
    { stock_actual, stock_minimo, punto_reorden }
  );
  res.json({ success: true, data });
});

export default router;
