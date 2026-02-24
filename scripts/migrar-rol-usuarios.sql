-- Migración: añadir columna rol a usuarios (si no existe)
-- Ejecutar: psql -d tu_base_datos -f scripts/migrar-rol-usuarios.sql

ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'usuario';

-- Restricción para valores permitidos
ALTER TABLE public.usuarios
DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('administrador', 'usuario'));

-- Actualizar registros existentes sin rol
UPDATE public.usuarios SET rol = 'usuario' WHERE rol IS NULL;
