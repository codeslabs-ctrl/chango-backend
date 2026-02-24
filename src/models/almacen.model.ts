export interface Almacen {
  almacen_id: number;
  nombre: string;
  ubicacion: string | null;
  estatus?: string;
  tiene_productos?: boolean;
}

export interface ProductoAlmacen {
  producto_almacen_id: number;
  producto_id: number;
  codigo_interno?: string;
  descripcion?: string;
  producto_nombre?: string;
  almacen_id: number;
  almacen_nombre?: string;
  stock_actual: number;
  stock_minimo: number;
  punto_reorden: number;
}

export interface CreateAlmacenDto {
  nombre: string;
  ubicacion?: string;
  estatus?: 'A' | 'C';
}

export interface UpdateAlmacenDto {
  nombre?: string;
  ubicacion?: string;
  estatus?: 'A' | 'C';
}

export interface UpdateStockDto {
  stock_actual?: number;
  stock_minimo?: number;
  punto_reorden?: number;
}
