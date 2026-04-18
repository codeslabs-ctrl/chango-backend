import { Router } from 'express';
import * as estadisticasService from '../services/estadisticas.service';
import { authenticateJWT } from '../middleware/auth';
import { requireNotVendedor, requireVendedor } from '../middleware/vendedorAuth';
import type { AuthRequest } from '../types/auth';
import { AppError } from '../utils/errors';

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

router.get('/resumen-por-vendedor', authenticateJWT, requireNotVendedor, async (req, res) => {
  const fechaDesde = typeof req.query.fechaDesde === 'string' ? req.query.fechaDesde : undefined;
  const fechaHasta = typeof req.query.fechaHasta === 'string' ? req.query.fechaHasta : undefined;
  const data = await estadisticasService.getResumenPorVendedor(fechaDesde, fechaHasta);
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

router.get('/cierre-venta-dia', authenticateJWT, requireNotVendedor, async (req, res) => {
  const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
  const data = await estadisticasService.getCierreVentaDia(fecha);
  res.json({ success: true, data });
});

router.get('/taza-dia', authenticateJWT, requireNotVendedor, async (_req, res) => {
  const data = await estadisticasService.getTazaDia();
  res.json({ success: true, data });
});

router.put('/taza-dia', authenticateJWT, requireNotVendedor, async (req, res) => {
  const valor = Number(req.body?.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return res.status(400).json({ success: false, message: 'Ingresá una taza del día válida.' });
  }
  try {
    const taza_manual = await estadisticasService.saveTazaDiaManual(valor);
    const data = await estadisticasService.getTazaDia();
    data.taza_manual = taza_manual;
    res.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    throw err;
  }
});

export default router;
