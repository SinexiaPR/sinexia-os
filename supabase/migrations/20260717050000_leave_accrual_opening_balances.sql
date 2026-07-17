-- Historical starting point for an employee's vacation/sick balance, for
-- when this module goes live after years of leave history that predate its
-- own ledger (e.g. imported from a prior manual tracking spreadsheet).
-- Stored once and re-applied on every replay (see replayLeaveHistory's
-- openingVacationHours/openingSickHours params) rather than written
-- directly into employee_leave_balances, which is otherwise fully derived
-- from employee_leave_ledger_entries and would be silently wiped the next
-- time that employee's ledger is replayed.
--
-- Same source_system discriminator + dual-nullable-FK pattern as the other
-- three leave accrual tables, for the same reason (no shared employee
-- registry between Sibarita and Tresbe). Admin-only, matching the rest of
-- the module.

CREATE TABLE IF NOT EXISTS public.employee_leave_opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source_system public.leave_accrual_source_system NOT NULL,
  sibarita_employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE RESTRICT,
  tresbe_employee_id UUID REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  opening_vacation_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (opening_vacation_hours >= 0),
  opening_sick_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (opening_sick_hours >= 0),
  as_of_year INTEGER NOT NULL CHECK (as_of_year BETWEEN 2000 AND 2100),
  as_of_month INTEGER NOT NULL CHECK (as_of_month BETWEEN 1 AND 12),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (source_system = 'sibarita' AND sibarita_employee_id IS NOT NULL AND tresbe_employee_id IS NULL) OR
    (source_system = 'tresbe' AND tresbe_employee_id IS NOT NULL AND sibarita_employee_id IS NULL)
  )
);
-- Plain (non-partial) unique indexes, same reasoning as the other leave
-- accrual tables: NULL <> NULL means each system's rows never collide with
-- the other's, and a plain column-list is what Supabase's
-- `.upsert(..., { onConflict })` needs as its conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_opening_balances_sibarita_uq
  ON public.employee_leave_opening_balances(sibarita_employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_opening_balances_tresbe_uq
  ON public.employee_leave_opening_balances(tresbe_employee_id);
CREATE INDEX IF NOT EXISTS employee_leave_opening_balances_company_id_idx
  ON public.employee_leave_opening_balances(company_id);
DROP TRIGGER IF EXISTS employee_leave_opening_balances_updated_at ON public.employee_leave_opening_balances;
CREATE TRIGGER employee_leave_opening_balances_updated_at
  BEFORE UPDATE ON public.employee_leave_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_leave_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leave opening balances" ON public.employee_leave_opening_balances
  FOR ALL TO authenticated
  USING (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  )
  WITH CHECK (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  );
