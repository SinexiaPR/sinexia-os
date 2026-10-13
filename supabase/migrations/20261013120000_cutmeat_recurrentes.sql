-- Recurrentes mensuales de Cut Meat Distributors (Wagyu Food Service LLC):
-- reemplaza la columna "Pagado" (el "1" de la columna L) del Google Sheet por
-- una tabla editable con historial de cambios. Reutiliza is_cut_meat_company()
-- y current_company_id() de la migración 20261012120000_cutmeat_daily_reports.sql
-- (módulo "Informes diarios") -- no se duplica lógica de RLS.
--
-- Admin lee y escribe. El cliente de esta empresa (Gabriel, el dueño) solo lee:
-- current_company_id() devuelve NULL para admins y para clientes de otra
-- empresa, así que la política de solo-lectura queda acotada sola.

CREATE TABLE IF NOT EXISTS public.cutmeat_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  period DATE NOT NULL,
  fecha DATE,
  tr_type TEXT,
  num TEXT,
  vendor TEXT NOT NULL CHECK (char_length(vendor) > 0),
  due_date DATE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  pagado BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  paid_amount NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS cutmeat_recurrentes_company_period_idx
  ON public.cutmeat_recurrentes (company_id, period);

DROP TRIGGER IF EXISTS cutmeat_recurrentes_updated_at ON public.cutmeat_recurrentes;
CREATE TRIGGER cutmeat_recurrentes_updated_at BEFORE UPDATE ON public.cutmeat_recurrentes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoría: quién, cuándo, qué (igual que cutmeat_daily_recurring_payment_history).
CREATE TABLE IF NOT EXISTS public.cutmeat_recurrentes_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrente_id UUID NOT NULL REFERENCES public.cutmeat_recurrentes(id) ON DELETE CASCADE,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cutmeat_recurrentes_history_recurrente_id_idx
  ON public.cutmeat_recurrentes_history (recurrente_id);

ALTER TABLE public.cutmeat_recurrentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_recurrentes" ON public.cutmeat_recurrentes;
CREATE POLICY "Admins manage cutmeat_recurrentes" ON public.cutmeat_recurrentes FOR ALL TO authenticated
USING (public.is_admin() AND public.is_cut_meat_company(company_id))
WITH CHECK (public.is_admin() AND public.is_cut_meat_company(company_id));

DROP POLICY IF EXISTS "Cut Meat client reads cutmeat_recurrentes" ON public.cutmeat_recurrentes;
CREATE POLICY "Cut Meat client reads cutmeat_recurrentes" ON public.cutmeat_recurrentes FOR SELECT TO authenticated
USING (public.current_company_id() = company_id);

ALTER TABLE public.cutmeat_recurrentes_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage cutmeat_recurrentes_history" ON public.cutmeat_recurrentes_history;
CREATE POLICY "Admins manage cutmeat_recurrentes_history" ON public.cutmeat_recurrentes_history FOR ALL TO authenticated
USING (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.cutmeat_recurrentes r
    WHERE r.id = recurrente_id AND public.is_cut_meat_company(r.company_id)
  )
)
WITH CHECK (
  public.is_admin() AND EXISTS (
    SELECT 1 FROM public.cutmeat_recurrentes r
    WHERE r.id = recurrente_id AND public.is_cut_meat_company(r.company_id)
  )
);

DROP POLICY IF EXISTS "Cut Meat client reads cutmeat_recurrentes_history" ON public.cutmeat_recurrentes_history;
CREATE POLICY "Cut Meat client reads cutmeat_recurrentes_history" ON public.cutmeat_recurrentes_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cutmeat_recurrentes r
    WHERE r.id = recurrente_id AND public.current_company_id() = r.company_id
  )
);
