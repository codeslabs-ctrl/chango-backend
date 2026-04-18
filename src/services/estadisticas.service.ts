import { pool, query } from '../config/db';

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

export interface CierreVentaDiaItem {
  tipo_pago: string;
  cantidad_ventas: number;
  monto_total: number;
}

export interface CierreVentaDiaResumen {
  fecha: string;
  resumen_por_metodo: CierreVentaDiaItem[];
  total_ventas: number;
  total_monto: number;
}

export async function getCierreVentaDia(fecha?: string): Promise<CierreVentaDiaResumen> {
  const f = fecha && FECHA_RE.test(fecha) ? fecha : new Date().toISOString().slice(0, 10);
  const { rows } = await query<{
    tipo_pago: string | null;
    cantidad_ventas: string | number;
    monto_total: string | number;
  }>(
    `SELECT COALESCE(mp.tipo_pago, 'sin metodo') AS tipo_pago,
            COUNT(*)::int AS cantidad_ventas,
            COALESCE(SUM(v.total_venta), 0)::numeric AS monto_total
     FROM public.ventas v
     LEFT JOIN public.metodo_pago_venta mv ON mv.venta_id = v.venta_id
     LEFT JOIN public.metodo_pago mp ON mp.metodo_id = mv.metodo_id
     WHERE v.fecha_venta::date = $1::date
       AND v.estatus NOT IN ('ANULADA', 'ELIMINADA')
     GROUP BY COALESCE(mp.tipo_pago, 'sin metodo')
     ORDER BY monto_total DESC, tipo_pago ASC`,
    [f]
  );

  const resumen_por_metodo: CierreVentaDiaItem[] = rows.map(r => ({
    tipo_pago: r.tipo_pago || 'sin metodo',
    cantidad_ventas: Number(r.cantidad_ventas) || 0,
    monto_total: Number(r.monto_total) || 0
  }));

  const total_ventas = resumen_por_metodo.reduce((acc, x) => acc + x.cantidad_ventas, 0);
  const total_monto = resumen_por_metodo.reduce((acc, x) => acc + x.monto_total, 0);
  return { fecha: f, resumen_por_metodo, total_ventas, total_monto };
}

export interface TazaDiaResumen {
  tasa_google: number | null;
  taza_manual: number | null;
  fuente_google: string;
}

const PARAM_NOMBRE_TAZA_DIA = 'taza del dia';

function parseGoogleUsdVesRate(html: string): number | null {
  const mDataLastPrice = html.match(/data-last-price="([0-9]+(?:\.[0-9]+)?)"/i);
  if (mDataLastPrice?.[1]) {
    const n = Number(mDataLastPrice[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const mClass = html.match(/class="YMlKec fxKbKc">([0-9]+(?:\.[0-9]+)?)/i);
  if (mClass?.[1]) {
    const n = Number(mClass[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function fetchGoogleUsdVesRate(): Promise<number | null> {
  try {
    const res = await fetch('https://www.google.com/finance/quote/USD-VES', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseGoogleUsdVesRate(html);
  } catch {
    return null;
  }
}

async function getTazaManualGuardada(): Promise<number | null> {
  const { rows } = await query<{ valor_parametro: string | null }>(
    `SELECT valor_parametro
     FROM public.parametros_generales
     WHERE LOWER(TRIM(nombre_parametro)) = LOWER(TRIM($1))
     ORDER BY id_parametro ASC
     LIMIT 1`,
    [PARAM_NOMBRE_TAZA_DIA]
  );
  const v = rows[0]?.valor_parametro;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getTazaDia(): Promise<TazaDiaResumen> {
  const [tasa_google, taza_manual] = await Promise.all([
    fetchGoogleUsdVesRate(),
    getTazaManualGuardada()
  ]);
  return {
    tasa_google,
    taza_manual,
    fuente_google: 'https://www.google.com/finance/quote/USD-VES'
  };
}

export async function saveTazaDiaManual(valor: number): Promise<number> {
  const taza = Number(valor);
  if (!Number.isFinite(taza) || taza <= 0) {
    throw new Error('Valor de taza del día inválido.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ id_parametro: number }>(
      `SELECT id_parametro
       FROM public.parametros_generales
       WHERE LOWER(TRIM(nombre_parametro)) = LOWER(TRIM($1))
       ORDER BY id_parametro ASC
       LIMIT 1
       FOR UPDATE`,
      [PARAM_NOMBRE_TAZA_DIA]
    );
    if (existing.rows[0]?.id_parametro) {
      await client.query(
        `UPDATE public.parametros_generales
         SET valor_parametro = $2
         WHERE id_parametro = $1`,
        [existing.rows[0].id_parametro, String(taza)]
      );
    } else {
      await client.query('LOCK TABLE public.parametros_generales IN SHARE ROW EXCLUSIVE MODE');
      const next = await client.query<{ next_id: number }>(
        `SELECT COALESCE(MAX(id_parametro), 0) + 1 AS next_id
         FROM public.parametros_generales`
      );
      await client.query(
        `INSERT INTO public.parametros_generales (id_parametro, nombre_parametro, valor_parametro)
         VALUES ($1, $2, $3)`,
        [next.rows[0].next_id, PARAM_NOMBRE_TAZA_DIA, String(taza)]
      );
    }
    await client.query('COMMIT');
    return taza;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
