import { Router, Response } from 'express';
import * as ventasService from '../services/ventas.service';
import type { ConfirmarVentaDto } from '../models/venta.model';
import { authenticateJWT } from '../middleware/auth';
import type { AuthRequest } from '../types/auth';

const router = Router();

/** Query string o array (Express); normaliza para filtros de estatus. */
function queryStringParam(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (Array.isArray(val)) {
    const first = val[0];
    return first != null && String(first).trim() !== '' ? String(first).trim() : undefined;
  }
  const s = String(val).trim();
  return s !== '' ? s : undefined;
}

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
  const data = await ventasService.confirmarVenta(id, req.body as ConfirmarVentaDto);
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
  const { cliente_id, tipo_pago, referencia_banco, detalles, confirmar } =
    req.body;

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
  const pagoIndicado = `${tipo_pago ?? ''}`.trim();
  if (confirmar && !pagoIndicado) {
    return res
      .status(400)
      .json({ success: false, message: 'El método de pago es obligatorio al confirmar la venta' });
  }

  const usuarioIdVendedor = req.user?.rol === 'vendedor' ? req.user.id : null;

  const result = await ventasService.crearVenta(
    {
      cliente_id,
      tipo_pago,
      referencia_banco,
      detalles,
      confirmar: !!confirmar
    },
    usuarioIdVendedor
  );
  res.status(201).json({ success: true, data: result });
});

router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const estatusRaw = queryStringParam(req.query.estatus);
  const estatusNorm = estatusRaw ? estatusRaw.replace(/_/g, ' ') : undefined;

  const pendientesTipoRaw = queryStringParam(req.query.pendientesTipo);
  const pendientesTipo =
    pendientesTipoRaw === 'vendedor' || pendientesTipoRaw === 'agente'
      ? pendientesTipoRaw
      : undefined;

  const filters: ventasService.VentasFilters = {
    clienteId: req.query.clienteId ? Number(req.query.clienteId) : undefined,
    estatus: pendientesTipo ? undefined : estatusNorm,
    fechaDesde: typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined,
    fechaHasta: typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined,
    busqueda: typeof req.query.busqueda === 'string' ? req.query.busqueda : undefined,
    pendientesTipo
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
