import { Router } from 'express';
import * as estadisticasService from '../services/estadisticas.service';

const router = Router();

router.get('/ventas-pendientes', async (_req, res) => {
  const data = await estadisticasService.getVentasPendientes();
  res.json({ success: true, data });
});

router.get('/comparativa-mensual', async (_req, res) => {
  const data = await estadisticasService.getComparativaMensual();
  res.json({ success: true, data });
});

router.get('/top-productos', async (_req, res) => {
  const data = await estadisticasService.getTopProductos();
  res.json({ success: true, data });
});

router.get('/stock-critico', async (_req, res) => {
  const data = await estadisticasService.getStockCritico();
  res.json({ success: true, data });
});

export default router;
