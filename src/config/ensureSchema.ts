import { pool } from './db';

/** Asegura columnas/tablas requeridas por la app (idempotente). */
export async function ensureSchema(): Promise<void> {
  await pool.query(
    `ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS referencia_pago TEXT`
  );

  await pool.query(
    `ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url TEXT NULL`
  );

  await pool.query(
    `ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS costo NUMERIC(14, 4) NOT NULL DEFAULT 0`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.metodo_pago (
      metodo_id SERIAL NOT NULL PRIMARY KEY,
      venta_id INT4 NOT NULL REFERENCES public.ventas (venta_id) ON DELETE CASCADE,
      tipo_pago VARCHAR(50) NOT NULL,
      referencia_banco TEXT NULL
    );
  `);
}
