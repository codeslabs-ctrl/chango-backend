import { query } from '../config/db';

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
