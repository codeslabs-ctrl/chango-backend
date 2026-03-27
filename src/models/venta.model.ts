export interface Venta {
  venta_id: number;
  cliente_id: number | null;
  cliente_nombre?: string | null;
  cliente_cedula_rif?: string | null;
  cliente_telefono?: string | null;
  productos_nombres?: string | null;
  /** Usuario (p. ej. vendedor) asociado; null en ventas antiguas o creadas por no vendedor */
  usuario_id?: number | null;
  usuario_nombre?: string | null;
  fecha_venta: Date;
  total_venta: number;
  metodo_pago: string | null;
  estatus: string;
}

export interface VentaDetalle {
  detalle_id: number;
  producto_id: number;
  producto_descripcion?: string;
  cantidad: number;
  precio_unitario: number;
}

export interface VentaConDetalles {
  venta: Venta;
  detalles: VentaDetalle[];
}

export interface DespachoAlmacenDto {
  almacen_id: number;
  cantidad: number;
}

export interface CreateVentaDetalleDto {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  /** Desglose por almacén: suma debe ser igual a cantidad */
  despachos: DespachoAlmacenDto[];
}

export interface CreateVentaDto {
  cliente_id?: number;
  metodo_pago?: string;
  detalles: CreateVentaDetalleDto[];
  confirmar?: boolean; // true = CONFIRMADA, false/omitido = PENDIENTE
}
