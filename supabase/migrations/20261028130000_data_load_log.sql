-- Registro de cargas operativas (Fase 5).
-- De ahora en adelante las cargas de datos operativos NO se hacen como migraciones:
-- se ejecutan con SQL puntual que llama a public.log_data_load() en la misma
-- transacción, de modo que la carga y su registro quedan juntos o no queda ninguno.
-- Convención completa en docs/DATA_LOADS.md. No se migra el historial existente.

CREATE TABLE IF NOT EXISTS public.data_load_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  modulo TEXT NOT NULL CHECK (char_length(trim(modulo)) BETWEEN 1 AND 100),
  fuente TEXT NOT NULL CHECK (char_length(trim(fuente)) BETWEEN 1 AND 300),
  descripcion TEXT NOT NULL CHECK (char_length(trim(descripcion)) BETWEEN 1 AND 2000),
  filas_afectadas INTEGER NOT NULL CHECK (filas_afectadas >= 0),
  -- NULL cuando la carga corre con service_role o desde el SQL editor (sin sesión).
  cargado_por UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  cargado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_load_log IS
  'Registro append-only de cargas operativas de datos (una fila por carga). Solo administradores.';

CREATE INDEX IF NOT EXISTS data_load_log_company_cargado_idx
  ON public.data_load_log (company_id, cargado_en DESC);

ALTER TABLE public.data_load_log ENABLE ROW LEVEL SECURITY;

-- Append-only: los administradores leen e insertan; nadie actualiza ni borra.
DROP POLICY IF EXISTS "Admins read data_load_log" ON public.data_load_log;
CREATE POLICY "Admins read data_load_log" ON public.data_load_log
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert data_load_log" ON public.data_load_log;
CREATE POLICY "Admins insert data_load_log" ON public.data_load_log
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

REVOKE ALL ON public.data_load_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.data_load_log TO authenticated, service_role;

-- Procedimiento de registro. SECURITY INVOKER a propósito: la RLS de arriba es la
-- única puerta (un cliente que lo llame recibe "violates row-level security policy"),
-- y no agrega otra función SECURITY DEFINER expuesta por RPC.
CREATE OR REPLACE FUNCTION public.log_data_load(
  p_company_id UUID,
  p_modulo TEXT,
  p_fuente TEXT,
  p_descripcion TEXT,
  p_filas_afectadas INTEGER
) RETURNS UUID
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.data_load_log (company_id, modulo, fuente, descripcion, filas_afectadas)
  VALUES (p_company_id, p_modulo, p_fuente, p_descripcion, p_filas_afectadas)
  RETURNING id;
$$;

COMMENT ON FUNCTION public.log_data_load(UUID, TEXT, TEXT, TEXT, INTEGER) IS
  'Registra una carga operativa en data_load_log. Llamar en la misma transacción que la carga.';

REVOKE ALL ON FUNCTION public.log_data_load(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_data_load(UUID, TEXT, TEXT, TEXT, INTEGER)
  TO authenticated, service_role;
