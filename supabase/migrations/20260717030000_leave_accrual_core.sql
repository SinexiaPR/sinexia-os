-- Core tables for the vacation/sick leave accrual module. Sibarita and
-- Tresbe have no shared employee registry, so every table here carries a
-- source_system discriminator plus two nullable per-system employee/entry
-- FKs (exactly one populated, enforced by CHECK + partial unique indexes)
-- rather than duplicating the whole table shape per system. This keeps real
-- referential integrity and a single query surface for the combined admin
-- report.
--
-- Visibility is admin-only throughout: Sinexia admins manage and read these
-- tables; there is deliberately no policy granting the client role any
-- access, since leave balances are HR-sensitive data the client-company
-- user should not see.

DO $$ BEGIN
  CREATE TYPE public.leave_accrual_source_system AS ENUM ('sibarita', 'tresbe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-company configurable sick balance cap (default 120h = 15 days).
CREATE TABLE IF NOT EXISTS public.leave_accrual_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  sick_balance_cap_hours NUMERIC(6,2) NOT NULL DEFAULT 120 CHECK (sick_balance_cap_hours > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS leave_accrual_settings_updated_at ON public.leave_accrual_settings;
CREATE TRIGGER leave_accrual_settings_updated_at
  BEFORE UPDATE ON public.leave_accrual_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.leave_accrual_settings (company_id)
SELECT id FROM public.companies WHERE slug IN ('sibarita', 'tresbe')
ON CONFLICT (company_id) DO NOTHING;

-- Current balance snapshot per employee. Derived/disposable: fully
-- recomputed by replaying employee_leave_ledger_entries through
-- replayLeaveHistory() every time that employee's ledger changes, never
-- incremented in place, so edits to hiring_date or reopened/re-edited
-- payrolls are always reflected correctly.
CREATE TABLE IF NOT EXISTS public.employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source_system public.leave_accrual_source_system NOT NULL,
  sibarita_employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE RESTRICT,
  tresbe_employee_id UUID REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  vacation_balance_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (vacation_balance_hours >= 0),
  sick_balance_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (sick_balance_hours >= 0),
  vacation_accrued_lifetime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  sick_accrued_lifetime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  vacation_used_lifetime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  sick_used_lifetime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_replayed_year INTEGER,
  last_replayed_month INTEGER CHECK (last_replayed_month BETWEEN 1 AND 12),
  last_payroll_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (source_system = 'sibarita' AND sibarita_employee_id IS NOT NULL AND tresbe_employee_id IS NULL) OR
    (source_system = 'tresbe' AND tresbe_employee_id IS NOT NULL AND sibarita_employee_id IS NULL)
  )
);
-- Plain (non-partial) unique indexes: NULL is never equal to NULL in
-- Postgres, so Tresbe rows (sibarita_employee_id always NULL) never
-- conflict with each other or with Sibarita rows, and vice versa — this
-- already gives per-system uniqueness without a WHERE predicate. That
-- matters because Supabase's `.upsert(..., { onConflict })` only emits a
-- plain `ON CONFLICT (columns)` column list; it cannot target a partial
-- index's predicate, so these must stay non-partial to be usable as an
-- upsert conflict target from application code.
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_balances_sibarita_uq
  ON public.employee_leave_balances(sibarita_employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_balances_tresbe_uq
  ON public.employee_leave_balances(tresbe_employee_id);
DROP TRIGGER IF EXISTS employee_leave_balances_updated_at ON public.employee_leave_balances;
CREATE TRIGGER employee_leave_balances_updated_at
  BEFORE UPDATE ON public.employee_leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One row per employee per calendar month, kept forever (never deleted).
CREATE TABLE IF NOT EXISTS public.employee_leave_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source_system public.leave_accrual_source_system NOT NULL,
  sibarita_employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE RESTRICT,
  tresbe_employee_id UUID REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  qualifying_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  qualifies BOOLEAN NOT NULL DEFAULT false,
  years_of_service NUMERIC(6,2) NOT NULL,
  tenure_tier TEXT NOT NULL CHECK (
    tenure_tier IN ('under_1', 'one_to_five', 'five_to_fifteen', 'over_fifteen')
  ),
  vacation_accrued_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  sick_accrued_hours NUMERIC(6,2) NOT NULL DEFAULT 0,
  vacation_used_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sick_used_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  vacation_balance_after_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sick_balance_after_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sick_cap_hours_applied NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (source_system = 'sibarita' AND sibarita_employee_id IS NOT NULL AND tresbe_employee_id IS NULL) OR
    (source_system = 'tresbe' AND tresbe_employee_id IS NOT NULL AND sibarita_employee_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_history_sibarita_uq
  ON public.employee_leave_history(sibarita_employee_id, period_year, period_month);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_history_tresbe_uq
  ON public.employee_leave_history(tresbe_employee_id, period_year, period_month);
DROP TRIGGER IF EXISTS employee_leave_history_updated_at ON public.employee_leave_history;
CREATE TRIGGER employee_leave_history_updated_at
  BEFORE UPDATE ON public.employee_leave_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One row per weekly-payroll-entry contribution to an employee-month. This
-- is what makes the whole module idempotent: reopening a payroll marks its
-- rows reversed_at instead of deleting them, and reprocessing upserts them
-- back in, so replaying an employee's ledger always reflects reality with
-- no double-counting, regardless of how many times a payroll is
-- reopened/re-edited/re-approved.
CREATE TABLE IF NOT EXISTS public.employee_leave_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  source_system public.leave_accrual_source_system NOT NULL,
  sibarita_employee_id UUID REFERENCES public.payroll_employees(id) ON DELETE RESTRICT,
  tresbe_employee_id UUID REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  sibarita_entry_id UUID REFERENCES public.weekly_payroll_entries(id) ON DELETE CASCADE,
  tresbe_entry_id UUID REFERENCES public.tresbe_payroll_entries(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  qualifying_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  vacation_used_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  sick_used_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  reversed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (source_system = 'sibarita' AND sibarita_entry_id IS NOT NULL AND tresbe_entry_id IS NULL) OR
    (source_system = 'tresbe' AND tresbe_entry_id IS NOT NULL AND sibarita_entry_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_ledger_sibarita_uq
  ON public.employee_leave_ledger_entries(sibarita_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_ledger_tresbe_uq
  ON public.employee_leave_ledger_entries(tresbe_entry_id);
CREATE INDEX IF NOT EXISTS employee_leave_ledger_active_period_idx
  ON public.employee_leave_ledger_entries(source_system, period_year, period_month)
  WHERE reversed_at IS NULL;

ALTER TABLE public.leave_accrual_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leave accrual settings" ON public.leave_accrual_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins manage leave balances" ON public.employee_leave_balances
  FOR ALL TO authenticated
  USING (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  )
  WITH CHECK (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  );

CREATE POLICY "Admins manage leave history" ON public.employee_leave_history
  FOR ALL TO authenticated
  USING (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  )
  WITH CHECK (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  );

CREATE POLICY "Admins manage leave ledger" ON public.employee_leave_ledger_entries
  FOR ALL TO authenticated
  USING (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  )
  WITH CHECK (
    public.is_admin() AND
    (public.is_sibarita_company(company_id) OR public.is_tresbe_company(company_id))
  );

-- History and ledger rows must never be deleted, even by an admin acting
-- through the application role.
REVOKE DELETE ON public.employee_leave_history FROM authenticated;
REVOKE DELETE ON public.employee_leave_ledger_entries FROM authenticated;
