import { query } from '../config/db';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizarFechasVendedor(fechaDesde?: string, fechaHasta?: string): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const defaultDesde = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const defaultHasta = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const desde = fechaDesde && FECHA_RE.test(fechaDesde) ? fechaDesde : defaultDesde;
  const hasta = fechaHasta && FECHA_RE.test(fechaHasta) ? fechaHasta : defaultHasta;
  return { desde, hasta };
}

/** Resumen de ventas del vendedor en un rango de fechas (excluye ELIMINADA). */
export async function getVendedorResumen(usuarioId: number, fechaDesde?: string, fechaHasta?: string) {
  const { desde, hasta } = normalizarFechasVendedor(fechaDesde, fechaHasta);
  const { rows } = await query<{
    monto_total: string | number;
    cantidad_ventas: string | number;
  }>(
    `SELECT COALESCE(SUM(v.total_venta), 0)::numeric AS monto_total,
            COUNT(*)::int AS cantidad_ventas
     FROM public.ventas v
     WHERE v.usuario_id = $1
       AND v.estatus <> 'ELIMINADA'
       AND v.fecha_venta::date >= $2::date
       AND v.fecha_venta::date <= $3::date`,
    [usuarioId, desde, hasta]
  );
  return rows[0] ?? { monto_total: 0, cantidad_ventas: 0 };
}

export async function getVendedorTopProductos(
  usuarioId: number,
  fechaDesde?: string,
  fechaHasta?: string,
  limit = 5
) {
  const { desde, hasta } = normalizarFechasVendedor(fechaDesde, fechaHasta);
  const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const { rows } = await query<{
    producto_id: number;
    nombre: string | null;
    ingresos_totales: string | number;
    unidades: string | number;
  }>(
    `SELECT p.producto_id,
            p.descripcion AS nombre,
            SUM(vd.cantidad * vd.precio_unitario)::numeric AS ingresos_totales,
            SUM(vd.cantidad)::numeric AS unidades
     FROM public.ventas_detalle vd
     JOIN public.ventas v ON v.venta_id = vd.venta_id
     JOIN public.productos p ON p.producto_id = vd.producto_id
     WHERE v.usuario_id = $1
       AND v.estatus <> 'ELIMINADA'
       AND v.fecha_venta::date >= $2::date
       AND v.fecha_venta::date <= $3::date
     GROUP BY p.producto_id, p.descripcion
     ORDER BY ingresos_totales DESC
     LIMIT $4`,
    [usuarioId, desde, hasta, lim]
  );
  return rows;
}

export async function getVendedorTopClientes(
  usuarioId: number,
  fechaDesde?: string,
  fechaHasta?: string,
  limit = 5
) {
  const { desde, hasta } = normalizarFechasVendedor(fechaDesde, fechaHasta);
  const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const { rows } = await query<{
    cliente_id: number;
    nombre: string | null;
    total: string | number;
    cantidad_ventas: string | number;
  }>(
    `SELECT c.cliente_id,
            c.nombre,
            SUM(v.total_venta)::numeric AS total,
            COUNT(*)::int AS cantidad_ventas
     FROM public.ventas v
     JOIN public.clientes c ON c.cliente_id = v.cliente_id
     WHERE v.usuario_id = $1
       AND v.estatus <> 'ELIMINADA'
       AND v.fecha_venta::date >= $2::date
       AND v.fecha_venta::date <= $3::date
     GROUP BY c.cliente_id, c.nombre
     ORDER BY total DESC
     LIMIT $4`,
    [usuarioId, desde, hasta, lim]
  );
  return rows;
}

/** Cola de aprobación - ventas pendientes */
export async function getVentasPendientes() {
  const { rows } = await query('SELECT * FROM vista_ventas_pendientes');
  return rows;
}

/** Comparativa Mes Actual vs Anterior */
export async function getComparativaMensual() {
  const { rows } = await query('SELECT * FROM vista_comparativa_mensual');
  return rows;
}

/** Top 10 Productos Más Vendidos */
export async function getTopProductos() {
  const { rows } = await query('SELECT * FROM vista_top_productos');
  return rows;
}

/** Stock crítico - total y alerta si está por debajo del umbral de 5 */
export async function getStockCritico() {
  const { rows } = await query('SELECT * FROM vista_stock_critico');
  return rows;
}
