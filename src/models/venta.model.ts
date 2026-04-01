export interface Venta {
  venta_id: number;
  cliente_id: number | null;
  cliente_nombre?: string | null;
  cliente_cedula_rif?: string | null;
  cliente_telefono?: string | null;
  productos_nombres?: string | null;
  /** Número de líneas / productos distintos en la venta */
  cantidad_productos?: number;
  /** Hasta 2 líneas del detalle con más unidades vendidas: imagen, descripción y cantidad */
  productos_destaque?: { imagen_url?: string | null; descripcion?: string | null; cantidad?: number }[] | null;
  /** Vendedor (usuario). Null → venta del agente; con valor → venta del vendedor. */
  usuario_id?: number | null;
  usuario_nombre?: string | null;
  fecha_venta: Date;
  total_venta: number;
  metodo_pago: string | null;
  /** Tipo normalizado (tabla `metodo_pago` o `ventas.metodo_pago`) */
  tipo_pago?: string | null;
  referencia_banco?: string | null;
  /** Nº referencia si el pago fue transferencia o pago móvil */
  referencia_pago?: string | null;
  cliente_email?: string | null;
  cliente_direccion?: string | null;
  estatus: string;
}

/** Body opcional al confirmar venta (facturación / datos de pago) */
export interface ConfirmarVentaDto {
  /** Código: efectivo | transaccion | pago movil */
  tipo_pago?: string;
  referencia_banco?: string;
  metodo_pago?: string;
  referencia_pago?: string;
  cliente?: {
    nombre?: string;
    cedula_rif?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
  };
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
  tipo_pago?: string;
  referencia_banco?: string;
  referencia_pago?: string;
  detalles: CreateVentaDetalleDto[];
  confirmar?: boolean; // true = CONFIRMADA, false/omitido = PENDIENTE
}
