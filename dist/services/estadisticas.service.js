"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVentasPendientes = getVentasPendientes;
exports.getComparativaMensual = getComparativaMensual;
exports.getTopProductos = getTopProductos;
exports.getStockCritico = getStockCritico;
const db_1 = require("../config/db");
/** Cola de aprobación - ventas pendientes */
async function getVentasPendientes() {
    const { rows } = await (0, db_1.query)('SELECT * FROM vista_ventas_pendientes');
    return rows;
}
/** Comparativa Mes Actual vs Anterior */
async function getComparativaMensual() {
    const { rows } = await (0, db_1.query)('SELECT * FROM vista_comparativa_mensual');
    return rows;
}
/** Top 10 Productos Más Vendidos */
async function getTopProductos() {
    const { rows } = await (0, db_1.query)('SELECT * FROM vista_top_productos');
    return rows;
}
/** Stock crítico - total y alerta si está por debajo del umbral de 5 */
async function getStockCritico() {
    const { rows } = await (0, db_1.query)('SELECT * FROM vista_stock_critico');
    return rows;
}
