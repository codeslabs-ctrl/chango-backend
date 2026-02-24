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
  fecha_ultimo_inventario: Date | null;
  estatus?: string;
  tiene_ventas?: boolean;
}

export interface ProductoAlmacenDto {
  almacen_id: number;
  stock_actual?: number;
}

export interface CreateProductoDto {
  codigo_interno: string;
  descripcion: string;
  nombre?: string;
  subcategoria_id?: number;
  proveedor_id?: number;
  unidad_medida?: string;
  precio_venta_sugerido?: number;
  almacenes?: ProductoAlmacenDto[];
  estatus?: 'A' | 'C';
}

export interface UpdateProductoDto extends Partial<CreateProductoDto> {}
