import { Router } from 'express';
import * as estadisticasService from '../services/estadisticas.service';
import { authenticateJWT } from '../middleware/auth';
import { requireNotVendedor, requireVendedor } from '../middleware/vendedorAuth';
import type { AuthRequest } from '../types/auth';

const router = Router();

router.get('/vendedor/resumen', authenticateJWT, requireVendedor, async (req: AuthRequest, res) => {
  const uid = req.user!.id;
  const fechaDesde = typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined;
  const fechaHasta = typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined;
  const data = await estadisticasService.getVendedorResumen(uid, fechaDesde, fechaHasta);
  res.json({ success: true, data });
});

router.get('/vendedor/top-productos', authenticateJWT, requireVendedor, async (req: AuthRequest, res) => {
  const uid = req.user!.id;
  const fechaDesde = typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined;
  const fechaHasta = typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined;
  const data = await estadisticasService.getVendedorTopProductos(uid, fechaDesde, fechaHasta);
  res.json({ success: true, data });
});

router.get('/vendedor/top-clientes', authenticateJWT, requireVendedor, async (req: AuthRequest, res) => {
  const uid = req.user!.id;
  const fechaDesde = typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined;
  const fechaHasta = typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined;
  const data = await estadisticasService.getVendedorTopClientes(uid, fechaDesde, fechaHasta);
  res.json({ success: true, data });
});

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
