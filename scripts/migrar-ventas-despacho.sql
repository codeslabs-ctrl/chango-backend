-- Tabla para registrar el despacho por almacén en cada detalle de venta
-- Ejecutar: psql -d tu_base_datos -f scripts/migrar-ventas-despacho.sql

CREATE TABLE IF NOT EXISTS public.ventas_detalle_despacho (
  venta_id INTEGER NOT NULL REFERENCES public.ventas(venta_id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES public.productos(producto_id),
  almacen_id INTEGER NOT NULL REFERENCES public.almacenes(almacen_id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (venta_id, producto_id, almacen_id)
);

CREATE INDEX IF NOT EXISTS idx_ventas_detalle_despacho_venta 
  ON public.ventas_detalle_despacho(venta_id);
