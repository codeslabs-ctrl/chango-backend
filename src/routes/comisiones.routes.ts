import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import type { AuthRequest } from '../types/auth';
import * as comisionesService from '../services/comisiones.service';

const router = Router();

router.use(authenticateJWT, requireAdmin);

router.get('/resumen', async (_req, res) => {
  const data = await comisionesService.getResumenPorVendedor();
  res.json({ success: true, data });
});

router.get('/vendedor/:id/ventas', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'ID de vendedor inválido.' });
  }
  const soloPendientes = req.query.soloPendientes === '1' || req.query.soloPendientes === 'true';
  const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
  const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
  const data = await comisionesService.getVentasComisionVendedor(id, {
    soloPendientes,
    desde,
    hasta
  });
  res.json({ success: true, data });
});

router.post('/marcar-pagadas', async (req: AuthRequest, res) => {
  const adminId = req.user?.id;
  if (!adminId) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }
  const vendedorId = Number(req.body?.vendedor_id);
  if (!Number.isFinite(vendedorId) || vendedorId <= 0) {
    return res.status(400).json({ success: false, message: 'Indique el vendedor (vendedor_id).' });
  }
  const hasta_fecha =
    typeof req.body?.hasta_fecha === 'string' && req.body.hasta_fecha.trim()
      ? req.body.hasta_fecha.trim()
      : undefined;
  const venta_ids = Array.isArray(req.body?.venta_ids)
    ? (req.body.venta_ids as unknown[]).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : undefined;

  const result = await comisionesService.marcarComisionesPagadas(adminId, vendedorId, {
    hasta_fecha,
    venta_ids: venta_ids && venta_ids.length > 0 ? venta_ids : undefined
  });
  res.json({
    success: true,
    data: result,
    message:
      result.actualizadas === 0
        ? 'No había ventas pendientes para marcar con esos criterios.'
        : `Se marcaron ${result.actualizadas} venta(s) con comisión pagada.`
  });
});

export default router;
