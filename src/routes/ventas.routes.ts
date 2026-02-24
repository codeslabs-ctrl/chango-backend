import { Router } from 'express';
import * as ventasService from '../services/ventas.service';

const router = Router();

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
    estatus: req.query.estatus as string | undefined
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

export default router;
