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

/** Cola de aprobación: pendientes de facturar. */
export async function getVentasPendientes() {
  const { rows } = await query<{ venta_id: number }>(
    `SELECT v.venta_id
     FROM public.ventas v
     WHERE v.estatus IN ('POR FACTURAR', 'PENDIENTE')`
  );
  return rows;
}

/** Comparativa Mes Actual vs Anterior */
export async function getComparativaMensual() {
  const { rows } = await query('SELECT * FROM vista_comparativa_mensual');
  return rows;
}

/**
 * Resumen por vendedor en rango (FACTURADA y demás no eliminadas).
 * usuario_id NULL agrupa ventas de agente externo.
 */
export async function getResumenPorVendedor(fechaDesde?: string, fechaHasta?: string) {
  const { desde, hasta } = normalizarFechasVendedor(fechaDesde, fechaHasta);
  const { rows } = await query<{
    usuario_id: number | null;
    nombre_usuario: string | null;
    unidades_vendidas: string | number;
    ingresos_totales: string | number;
  }>(
    `WITH por_venta AS (
       SELECT v.usuario_id,
              v.venta_id,
              v.total_venta,
              SUM(vd.cantidad)::numeric AS unidades_linea
       FROM public.ventas v
       INNER JOIN public.ventas_detalle vd ON vd.venta_id = v.venta_id
       WHERE v.estatus <> 'ELIMINADA'
         AND v.fecha_venta::date >= $1::date
         AND v.fecha_venta::date <= $2::date
       GROUP BY v.usuario_id, v.venta_id, v.total_venta
     ),
     por_vendedor AS (
       SELECT usuario_id,
              SUM(unidades_linea)::numeric AS unidades_vendidas,
              SUM(total_venta)::numeric AS ingresos_totales
       FROM por_venta
       GROUP BY usuario_id
     )
     SELECT p.usuario_id,
            u.nombre_usuario,
            p.unidades_vendidas,
            p.ingresos_totales
     FROM por_vendedor p
     LEFT JOIN public.usuarios u ON u.id = p.usuario_id
     ORDER BY p.ingresos_totales DESC NULLS LAST`,
    [desde, hasta]
  );
  return rows;
}

/** Top 10 productos por unidades vendidas (histórico, ventas no eliminadas). */
export async function getTopProductos() {
  const { rows } = await query<{
    producto_id: number;
    nombre: string | null;
    codigo_interno: string | null;
    unidades_vendidas: string | number;
  }>(
    `SELECT p.producto_id,
            COALESCE(
              NULLIF(TRIM(p.descripcion), ''),
              NULLIF(TRIM(p.nombre), ''),
              p.codigo_interno,
              '#'
            ) AS nombre,
            p.codigo_interno,
            SUM(vd.cantidad)::numeric AS unidades_vendidas
     FROM public.ventas_detalle vd
     INNER JOIN public.ventas v ON v.venta_id = vd.venta_id
     INNER JOIN public.productos p ON p.producto_id = vd.producto_id
     WHERE v.estatus <> 'ELIMINADA'
     GROUP BY p.producto_id, p.descripcion, p.nombre, p.codigo_interno
     ORDER BY unidades_vendidas DESC
     LIMIT 10`
  );
  return rows;
}

/** Stock crítico - total y alerta si está por debajo del umbral de 5 */
export async function getStockCritico() {
  const { rows } = await query('SELECT * FROM vista_stock_critico');
  return rows;
}
