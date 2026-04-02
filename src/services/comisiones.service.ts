import { query } from '../config/db';
import { AppError } from '../utils/errors';

const ESTATUS_COMISION = 'FACTURADA';

export type ResumenComisionVendedor = {
  usuario_id: number;
  nombre_usuario: string | null;
  username: string;
  porcentaje_comision: string | number;
  ventas_pendientes: number;
  monto_ventas_pendientes: string | number;
  comision_pendiente: string | number;
  ventas_pagadas: number;
  comision_pagada_total: string | number;
};

export type VentaComisionRow = {
  venta_id: number;
  fecha_venta: string;
  total_venta: string | number;
  porcentaje_comision: string | number;
  monto_comision: string | number;
  comision_pagada: boolean;
  comision_pagada_at: string | null;
};

async function assertVendedor(usuarioId: number): Promise<void> {
  const { rows } = await query<{ rol: string }>(
    `SELECT rol FROM public.usuarios WHERE id = $1`,
    [usuarioId]
  );
  const r = rows[0];
  if (!r) throw new AppError('Usuario no encontrado', 404);
  if (r.rol !== 'vendedor') {
    throw new AppError('Solo se gestionan comisiones de usuarios con rol vendedor.', 400);
  }
}

export async function getResumenPorVendedor(): Promise<ResumenComisionVendedor[]> {
  const { rows } = await query<ResumenComisionVendedor>(
    `SELECT u.id AS usuario_id,
            u.nombre_usuario,
            u.username,
            COALESCE(u.porcentaje_comision, 0) AS porcentaje_comision,
            COUNT(v.*) FILTER (
              WHERE v.comision_pagada = false
                AND v.estatus = $1
                AND v.usuario_id IS NOT NULL
            )::int AS ventas_pendientes,
            COALESCE(SUM(v.total_venta) FILTER (
              WHERE v.comision_pagada = false
                AND v.estatus = $1
                AND v.usuario_id IS NOT NULL
            ), 0) AS monto_ventas_pendientes,
            COALESCE(SUM(v.total_venta * COALESCE(u.porcentaje_comision, 0) / 100.0) FILTER (
              WHERE v.comision_pagada = false
                AND v.estatus = $1
                AND v.usuario_id IS NOT NULL
            ), 0) AS comision_pendiente,
            COUNT(v.*) FILTER (
              WHERE v.comision_pagada = true
                AND v.estatus = $1
                AND v.usuario_id IS NOT NULL
            )::int AS ventas_pagadas,
            COALESCE(SUM(v.total_venta * COALESCE(u.porcentaje_comision, 0) / 100.0) FILTER (
              WHERE v.comision_pagada = true
                AND v.estatus = $1
                AND v.usuario_id IS NOT NULL
            ), 0) AS comision_pagada_total
     FROM public.usuarios u
     LEFT JOIN public.ventas v ON v.usuario_id = u.id
     WHERE u.rol = 'vendedor'
     GROUP BY u.id, u.nombre_usuario, u.username, u.porcentaje_comision
     ORDER BY u.nombre_usuario NULLS LAST, u.username`,
    [ESTATUS_COMISION]
  );
  return rows;
}

export async function getVentasComisionVendedor(
  vendedorId: number,
  opts?: { soloPendientes?: boolean; desde?: string; hasta?: string }
): Promise<VentaComisionRow[]> {
  await assertVendedor(vendedorId);
  const params: unknown[] = [vendedorId, ESTATUS_COMISION];
  let idx = 3;
  let extra = '';
  if (opts?.soloPendientes) {
    extra += ` AND v.comision_pagada = false`;
  }
  if (opts?.desde && /^\d{4}-\d{2}-\d{2}$/.test(opts.desde)) {
    extra += ` AND v.fecha_venta::date >= $${idx}::date`;
    params.push(opts.desde);
    idx += 1;
  }
  if (opts?.hasta && /^\d{4}-\d{2}-\d{2}$/.test(opts.hasta)) {
    extra += ` AND v.fecha_venta::date <= $${idx}::date`;
    params.push(opts.hasta);
    idx += 1;
  }

  const { rows } = await query<VentaComisionRow>(
    `SELECT v.venta_id,
            v.fecha_venta::text AS fecha_venta,
            v.total_venta,
            COALESCE(u.porcentaje_comision, 0) AS porcentaje_comision,
            (v.total_venta * COALESCE(u.porcentaje_comision, 0) / 100.0) AS monto_comision,
            v.comision_pagada,
            v.comision_pagada_at::text AS comision_pagada_at
     FROM public.ventas v
     INNER JOIN public.usuarios u ON u.id = v.usuario_id
     WHERE v.usuario_id = $1
       AND v.estatus = $2
       ${extra}
     ORDER BY v.fecha_venta DESC, v.venta_id DESC`,
    params
  );
  return rows;
}

export async function marcarComisionesPagadas(
  adminId: number,
  vendedorId: number,
  dto: { hasta_fecha?: string; venta_ids?: number[] }
): Promise<{ actualizadas: number }> {
  await assertVendedor(vendedorId);

  if (dto.venta_ids && dto.venta_ids.length > 0) {
    const { rowCount } = await query(
      `UPDATE public.ventas v
       SET comision_pagada = true,
           comision_pagada_at = now(),
           comision_pagada_por = $1
       WHERE v.venta_id = ANY($2::int[])
         AND v.usuario_id = $3
         AND v.estatus = $4
         AND v.comision_pagada = false`,
      [adminId, dto.venta_ids, vendedorId, ESTATUS_COMISION]
    );
    return { actualizadas: rowCount ?? 0 };
  }

  if (dto.hasta_fecha && /^\d{4}-\d{2}-\d{2}$/.test(dto.hasta_fecha)) {
    const { rowCount } = await query(
      `UPDATE public.ventas v
       SET comision_pagada = true,
           comision_pagada_at = now(),
           comision_pagada_por = $1
       WHERE v.usuario_id = $2
         AND v.estatus = $3
         AND v.comision_pagada = false
         AND v.fecha_venta::date <= $4::date`,
      [adminId, vendedorId, ESTATUS_COMISION, dto.hasta_fecha]
    );
    return { actualizadas: rowCount ?? 0 };
  }

  const { rowCount } = await query(
    `UPDATE public.ventas v
     SET comision_pagada = true,
         comision_pagada_at = now(),
         comision_pagada_por = $1
     WHERE v.usuario_id = $2
       AND v.estatus = $3
       AND v.comision_pagada = false`,
    [adminId, vendedorId, ESTATUS_COMISION]
  );
  return { actualizadas: rowCount ?? 0 };
}
