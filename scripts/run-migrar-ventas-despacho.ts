/**
 * Ejecuta la migración ventas_detalle_despacho.
 * Uso: npx ts-node scripts/run-migrar-ventas-despacho.ts
 */
import { pool } from '../src/config/db';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const sqlPath = path.join(__dirname, 'migrar-ventas-despacho.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migración ventas_detalle_despacho ejecutada correctamente.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
