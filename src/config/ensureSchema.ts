import { pool } from './db';

/** Asegura columnas/tablas requeridas por la app (idempotente). */
export async function ensureSchema(): Promise<void> {
  await pool.query(
    `ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url TEXT NULL`
  );

  await pool.query(
    `ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS costo NUMERIC(14, 4) NOT NULL DEFAULT 0`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.metodo_pago (
      metodo_id SERIAL NOT NULL PRIMARY KEY,
      tipo_pago VARCHAR(50) NOT NULL UNIQUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.metodo_pago_producto (
      metodo_id INT4 NOT NULL REFERENCES public.metodo_pago (metodo_id) ON DELETE CASCADE,
      producto_id INT4 NOT NULL REFERENCES public.productos (producto_id) ON DELETE CASCADE,
      precio NUMERIC(12,2) NOT NULL,
      PRIMARY KEY (metodo_id, producto_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.metodo_pago_venta (
      metodo_id INT4 NOT NULL REFERENCES public.metodo_pago (metodo_id) ON DELETE RESTRICT,
      venta_id INT4 NOT NULL REFERENCES public.ventas (venta_id) ON DELETE CASCADE,
      referencia VARCHAR(100) NULL,
      PRIMARY KEY (metodo_id, venta_id)
    );
  `);

  await pool.query(`
    INSERT INTO public.metodo_pago (tipo_pago)
    VALUES ('efectivo'), ('pago movil'), ('transferencia'), ('cashea'), ('divisa')
    ON CONFLICT (tipo_pago) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO public.metodo_pago_producto (metodo_id, producto_id, precio)
    SELECT mp.metodo_id, p.producto_id,
           CASE
             WHEN LOWER(TRIM(mp.tipo_pago)) IN ('efectivo', 'pago movil', 'transferencia')
               THEN COALESCE(p.precio_venta_sugerido, 0)
             ELSE 0
           END AS precio
    FROM public.metodo_pago mp
    CROSS JOIN public.productos p
    ON CONFLICT (metodo_id, producto_id) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.ventas_detalle_despacho (
      venta_id INTEGER NOT NULL REFERENCES public.ventas(venta_id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES public.productos(producto_id),
      almacen_id INTEGER NOT NULL REFERENCES public.almacenes(almacen_id),
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      PRIMARY KEY (venta_id, producto_id, almacen_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ventas_detalle_despacho_venta
      ON public.ventas_detalle_despacho(venta_id);
  `);
}
