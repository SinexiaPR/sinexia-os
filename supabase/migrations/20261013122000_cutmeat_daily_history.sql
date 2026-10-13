-- Historial diario (backfill) de conciliación de Cut Meat Distributors
-- (Wagyu Food Service LLC): un resumen por día, cargado desde los PDF
-- originales que viven en Drive (no se copian, solo se referencia el
-- origen). Solo datos -- no hay motor de cálculo acá, los valores ya
-- vienen calculados del PDF/Sheet original.
--
-- Nombrada "cutmeat_daily_history" (y no "cutmeat_daily_reports") para no
-- colisionar con la tabla del mismo nombre del módulo "Informes diarios"
-- (20261012120000_cutmeat_daily_reports.sql), que es un esquema distinto
-- (el "día" vivo, en curso, con sus tablas hijas de reconciliación/banco/
-- aging). Esta tabla es el equivalente de solo-lectura para días ya
-- cerrados y archivados.

CREATE TABLE IF NOT EXISTS public.cutmeat_daily_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  statement_balance NUMERIC(12, 2) NOT NULL,
  uncleared_checks_as_of NUMERIC(12, 2) NOT NULL DEFAULT 0,
  uncleared_checks_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
  uncleared_deposits_as_of NUMERIC(12, 2) NOT NULL DEFAULT 0,
  uncleared_deposits_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
  register_balance NUMERIC(12, 2) NOT NULL,
  recurrentes_prior NUMERIC(12, 2) NOT NULL DEFAULT 0,
  recurrentes_week NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_after_weekly NUMERIC(12, 2) NOT NULL,
  balance_gabriel NUMERIC(12, 2) NOT NULL,
  aging_vendors_total NUMERIC(12, 2),
  aging_customers_total NUMERIC(12, 2),
  source TEXT NOT NULL DEFAULT 'backfill-drive',
  pdf_source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  UNIQUE (company_id, report_date)
);
CREATE INDEX IF NOT EXISTS cutmeat_daily_history_company_date_idx
  ON public.cutmeat_daily_history (company_id, report_date);

DROP TRIGGER IF EXISTS cutmeat_daily_history_updated_at ON public.cutmeat_daily_history;
CREATE TRIGGER cutmeat_daily_history_updated_at BEFORE UPDATE ON public.cutmeat_daily_history
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cutmeat_daily_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_daily_history" ON public.cutmeat_daily_history;
CREATE POLICY "Admins manage cutmeat_daily_history" ON public.cutmeat_daily_history FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

DROP POLICY IF EXISTS "Cut Meat client reads cutmeat_daily_history" ON public.cutmeat_daily_history;
CREATE POLICY "Cut Meat client reads cutmeat_daily_history" ON public.cutmeat_daily_history FOR SELECT TO authenticated
USING (public.current_company_id() = company_id);
