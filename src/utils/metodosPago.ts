/** Valores guardados en `metodo_pago.tipo_pago` y relacionados por `metodo_pago_venta`. */
export const TIPO_PAGO_A_CONVENIR = 'A_CONVENIR';

/** Catálogo de tipos de pago válidos para operar ventas. */
export const TIPOS_PAGO_OPCIONES = [
  'efectivo',
  'pago movil',
  'transferencia',
  'cashea',
  'divisa'
] as const;
export type TipoPagoOpcion = (typeof TIPOS_PAGO_OPCIONES)[number];

const NORMALIZE = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

export function normalizarTipoPago(raw: string | null | undefined): string {
  const t = NORMALIZE(raw || '');
  if (!t) return TIPO_PAGO_A_CONVENIR;
  if (t === 'a convenir' || t === 'a_convenir' || t === 'aconvenir') return TIPO_PAGO_A_CONVENIR;
  if (t === 'efectivo') return 'efectivo';
  if (t === 'transaccion' || t.includes('transfer')) return 'transferencia';
  if (t === 'pagomovil' || t === 'pago movil' || t.includes('pago movil')) return 'pago movil';
  if (t.includes('cashea')) return 'cashea';
  if (t === 'divisa' || t === 'dolar' || t === 'dolares' || t === 'usd') return 'divisa';
  return (raw || '').trim() || TIPO_PAGO_A_CONVENIR;
}

export function etiquetaTipoPago(codigo: string | null | undefined): string {
  const c = normalizarTipoPago(codigo);
  switch (c) {
    case 'efectivo':
      return 'Efectivo';
    case 'transferencia':
      return 'Transferencia';
    case 'pago movil':
      return 'Pago móvil';
    case 'cashea':
      return 'Cashea';
    case 'divisa':
      return 'Divisa';
    case TIPO_PAGO_A_CONVENIR:
      return 'A convenir';
    default:
      return codigo || '-';
  }
}

/** Solo transferencia o pago móvil requieren referencia. */
export function requiereReferenciaTipoPago(tipo: string | null | undefined): boolean {
  const n = normalizarTipoPago(tipo);
  return n === 'transferencia' || n === 'pago movil';
}

export function esTipoPagoValidoParaScroll(raw: string | null | undefined): boolean {
  const n = normalizarTipoPago(raw);
  return TIPOS_PAGO_OPCIONES.includes(n as TipoPagoOpcion);
}
