import { Router, Response } from 'express';
import * as ventasService from '../services/ventas.service';
import { authenticateJWT } from '../middleware/auth';
import type { AuthRequest } from '../types/auth';

const router = Router();

router.patch('/:id/confirmar', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const pre = await ventasService.findVentaById(id);
  if (!pre) {
    return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  }
  if (
    req.user?.rol === 'vendedor' &&
    req.user.id != null &&
    !ventasService.vendedorPuedeAccederVenta(pre.venta, req.user.id)
  ) {
    return res.status(403).json({ success: false, message: 'No tenés permiso para esta venta.' });
  }
  const data = await ventasService.confirmarVenta(id);
  if (!data) {
    return res.status(404).json({ success: false, message: 'Venta no encontrada o ya confirmada' });
  }
  res.json({ success: true, data });
});

router.patch('/:id/eliminar', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const pre = await ventasService.findVentaById(id);
  if (!pre) {
    return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  }
  if (
    req.user?.rol === 'vendedor' &&
    req.user.id != null &&
    !ventasService.vendedorPuedeAccederVenta(pre.venta, req.user.id)
  ) {
    return res.status(403).json({ success: false, message: 'No tenés permiso para esta venta.' });
  }
  const data = await ventasService.eliminarVenta(id);
  if (!data) {
    return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  }
  res.json({ success: true, data });
});

router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const { cliente_id, metodo_pago, detalles, confirmar } = req.body;

  if (cliente_id == null || cliente_id === '') {
    return res
      .status(400)
      .json({ success: false, message: 'El cliente es obligatorio' });
  }
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

  const usuarioIdVendedor = req.user?.rol === 'vendedor' ? req.user.id : null;

  const result = await ventasService.crearVenta(
    {
      cliente_id,
      metodo_pago,
      detalles,
      confirmar: !!confirmar
    },
    usuarioIdVendedor
  );
  res.status(201).json({ success: true, data: result });
});

router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const filters: ventasService.VentasFilters = {
    clienteId: req.query.clienteId ? Number(req.query.clienteId) : undefined,
    estatus: typeof req.query.estatus === 'string' ? req.query.estatus : undefined,
    fechaDesde: typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined,
    fechaHasta: typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined,
    busqueda: typeof req.query.busqueda === 'string' ? req.query.busqueda : undefined
  };
  if (req.user?.rol === 'vendedor' && req.user.id != null) {
    filters.usuarioId = req.user.id;
  }
  const data = await ventasService.findAllVentas(filters);
  res.json({ success: true, data });
});

router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const data = await ventasService.findVentaById(id);
  if (!data) {
    return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  }
  if (
    req.user?.rol === 'vendedor' &&
    req.user.id != null &&
    !ventasService.vendedorPuedeAccederVenta(data.venta, req.user.id)
  ) {
    return res.status(403).json({ success: false, message: 'No tenés permiso para esta venta.' });
  }
  res.json({ success: true, data });
});

export default router;
