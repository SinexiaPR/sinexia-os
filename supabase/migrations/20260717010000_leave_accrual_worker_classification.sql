-- Adds a legal worker-classification field (W2 payroll vs. services/contractor)
-- and, for Sibarita, a hiring date — both needed by the new vacation/sick
-- leave accrual module. Tresbe already has hiring_date from a prior
-- migration. Defaults every existing employee to 'w2' so nothing currently
-- accruing loses eligibility; admins can reclassify individual employees.

DO $$ BEGIN
  CREATE TYPE public.worker_classification AS ENUM ('w2', 'services', 'contractor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payroll_employees
  ADD COLUMN IF NOT EXISTS worker_classification public.worker_classification
    NOT NULL DEFAULT 'w2',
  ADD COLUMN IF NOT EXISTS hiring_date DATE;

ALTER TABLE public.tresbe_employees
  ADD COLUMN IF NOT EXISTS worker_classification public.worker_classification
    NOT NULL DEFAULT 'w2';

-- payroll_employees allows the client's own company user to UPDATE rows
-- ("Sibarita users update payroll employees"), but hiring_date and
-- worker_classification must only ever be edited by a Sinexia admin.
-- tresbe_employees needs no equivalent guard: its RLS is already
-- admin-only for every write ("Admins manage Tresbe employees").
CREATE OR REPLACE FUNCTION public.protect_admin_only_employee_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.worker_classification IS DISTINCT FROM OLD.worker_classification
    OR NEW.hiring_date IS DISTINCT FROM OLD.hiring_date
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can edit worker classification or hiring date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payroll_employees_admin_only_fields ON public.payroll_employees;
CREATE TRIGGER payroll_employees_admin_only_fields
  BEFORE UPDATE OF worker_classification, hiring_date ON public.payroll_employees
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_only_employee_fields();
