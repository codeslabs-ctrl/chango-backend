import { Router } from 'express';
import * as estadisticasService from '../services/estadisticas.service';
import { authenticateJWT } from '../middleware/auth';
import { requireNotVendedor } from '../middleware/vendedorAuth';

const router = Router();

router.get('/ventas-pendientes', authenticateJWT, requireNotVendedor, async (_req, res) => {
  const data = await estadisticasService.getVentasPendientes();
  res.json({ success: true, data });
});

router.get('/comparativa-mensual', authenticateJWT, requireNotVendedor, async (_req, res) => {
  const data = await estadisticasService.getComparativaMensual();
  res.json({ success: true, data });
});

router.get('/top-productos', authenticateJWT, requireNotVendedor, async (_req, res) => {
  const data = await estadisticasService.getTopProductos();
  res.json({ success: true, data });
});

router.get('/stock-critico', authenticateJWT, requireNotVendedor, async (_req, res) => {
  const data = await estadisticasService.getStockCritico();
  res.json({ success: true, data });
});

export default router;
