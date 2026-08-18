-- Read-only archive of Sibarita's historical weekly payroll spreadsheets
-- (name, hours, tips, other pay, total paid). Distinct from the operational
-- weekly_payrolls/weekly_payroll_entries draft workflow, which has no tips
-- column and isn't meant for bulk historical loads.

CREATE TABLE IF NOT EXISTS public.sibarita_payroll_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  section TEXT,
  employee_name TEXT NOT NULL CHECK (char_length(trim(employee_name)) BETWEEN 1 AND 200),
  total_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
  tips NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tips >= 0),
  other_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  weekly_payroll NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (weekly_payroll >= 0),
  source_title TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sibarita_payroll_history_dates CHECK (week_end = week_start + 6)
);

CREATE INDEX IF NOT EXISTS sibarita_payroll_history_company_week_idx
  ON public.sibarita_payroll_history(company_id, week_start DESC);

ALTER TABLE public.sibarita_payroll_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sibarita users read payroll history"
  ON public.sibarita_payroll_history FOR SELECT TO authenticated
  USING (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id = public.current_company_id()));

CREATE POLICY "Admins manage payroll history"
  ON public.sibarita_payroll_history FOR ALL TO authenticated
  USING (public.is_sibarita_company(company_id) AND public.is_admin())
  WITH CHECK (public.is_sibarita_company(company_id) AND public.is_admin());
