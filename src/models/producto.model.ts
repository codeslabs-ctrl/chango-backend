export interface Producto {
  producto_id: number;
  codigo_interno: string;
  descripcion: string;
  nombre: string | null;
  subcategoria_id: number | null;
  subcategoria_nombre?: string | null;
  proveedor_id: number | null;
  proveedor_nombre?: string | null;
  existencia_actual: number;
  unidad_medida: string | null;
  precio_venta_sugerido: number;
  /** Costo unitario (referencia interna) */
  costo?: number;
  fecha_ultimo_inventario: Date | null;
  estatus?: string;
  tiene_ventas?: boolean;
  /** Ruta pública servida bajo `/uploads/productos/...` o URL absoluta legada */
  imagen_url?: string | null;
  precios_metodo?: ProductoPrecioMetodo[];
}

export interface ProductoPrecioMetodo {
  metodo_id: number;
  tipo_pago: string;
  precio: number;
}

export interface ProductoAlmacenDto {
  almacen_id: number;
  stock_actual?: number;
  /** Si no se envía, el backend usa 10 */
  stock_minimo?: number;
}

export interface CreateProductoDto {
  codigo_interno: string;
  descripcion: string;
  nombre?: string;
  subcategoria_id?: number;
  proveedor_id?: number;
  unidad_medida?: string;
  precio_venta_sugerido?: number;
  costo?: number;
  almacenes?: ProductoAlmacenDto[];
  precios_metodo?: { metodo_id: number; precio: number }[];
  estatus?: 'A' | 'C';
}

export interface UpdateProductoDto extends Partial<CreateProductoDto> {}
