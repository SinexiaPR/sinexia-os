-- Follow-up to 20260717060000: 10 active Tresbe employees have a period
-- after a middle initial in tresbe_employees.normalized_name (e.g.
-- "adalberto j. cuadrado") that the source spreadsheet's names never had
-- ("adalberto j cuadrado"), so the exact-match join in the prior migration
-- missed them even though they're clearly the same person. Re-matches just
-- those 10, comparing with periods stripped from both sides, and loads the
-- same hiring date / opening balance data for them. Every other row in this
-- temp table is a subset already handled (or already correctly unmatched)
-- by the prior migration; ON CONFLICT keeps this idempotent either way.

DROP TABLE IF EXISTS pg_temp.tresbe_leave_opening_period_fix_20260717;
CREATE TEMP TABLE tresbe_leave_opening_period_fix_20260717 (
  normalized_name TEXT PRIMARY KEY,
  hiring_date DATE NOT NULL,
  opening_vacation_hours NUMERIC(8,2) NOT NULL,
  opening_sick_hours NUMERIC(8,2) NOT NULL,
  as_of_year INTEGER NOT NULL,
  as_of_month INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO tresbe_leave_opening_period_fix_20260717 VALUES
  ('adalberto j cuadrado', DATE '2023-01-25', 92, 120, 2026, 7),
  ('alberto l chaves', DATE '2026-03-11', 12, 24, 2026, 7),
  ('doel a acosta', DATE '2023-08-02', 166, 120, 2026, 7),
  ('gustavo g samot', DATE '2024-11-13', 0, 0, 2026, 7),
  ('jezaiah l perez silvestre', DATE '2026-03-11', 0, 0, 2026, 7),
  ('krystal m nieves', DATE '2022-09-07', 8, 16, 2026, 4),
  ('lee j de jesus sanchez', DATE '2022-02-03', 4, 8, 2026, 7),
  ('leslie a ruiz santiago', DATE '2024-01-31', 16, 24, 2026, 6),
  ('marc a lopez', DATE '2024-09-11', 28, 56, 2026, 7),
  ('paola c franco negron', DATE '2026-03-11', 0, 0, 2026, 7);

WITH matches AS (
  SELECT sheet.*, employee.id AS employee_id, employee.company_id AS company_id
  FROM tresbe_leave_opening_period_fix_20260717 sheet
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND replace(employee.normalized_name, '.', '') = sheet.normalized_name
)
UPDATE public.tresbe_employees employee
SET hiring_date = matches.hiring_date
FROM matches
WHERE employee.id = matches.employee_id;

WITH matches AS (
  SELECT sheet.*, employee.id AS employee_id, employee.company_id AS company_id
  FROM tresbe_leave_opening_period_fix_20260717 sheet
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND replace(employee.normalized_name, '.', '') = sheet.normalized_name
)
INSERT INTO public.employee_leave_opening_balances (
  company_id, source_system, tresbe_employee_id,
  opening_vacation_hours, opening_sick_hours, as_of_year, as_of_month, note
)
SELECT
  company_id, 'tresbe', employee_id,
  opening_vacation_hours, opening_sick_hours, as_of_year, as_of_month,
  'Imported from Calculo_Vacaciones_Enfermedad_Tresbe.xlsx (Resumen empleados)'
FROM matches
ON CONFLICT (tresbe_employee_id) DO UPDATE SET
  opening_vacation_hours = EXCLUDED.opening_vacation_hours,
  opening_sick_hours = EXCLUDED.opening_sick_hours,
  as_of_year = EXCLUDED.as_of_year,
  as_of_month = EXCLUDED.as_of_month,
  note = EXCLUDED.note;

WITH matches AS (
  SELECT sheet.*, employee.id AS employee_id, employee.company_id AS company_id
  FROM tresbe_leave_opening_period_fix_20260717 sheet
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND replace(employee.normalized_name, '.', '') = sheet.normalized_name
)
INSERT INTO public.employee_leave_balances (
  company_id, source_system, tresbe_employee_id,
  vacation_balance_hours, sick_balance_hours,
  vacation_accrued_lifetime_hours, sick_accrued_lifetime_hours,
  vacation_used_lifetime_hours, sick_used_lifetime_hours,
  last_replayed_year, last_replayed_month
)
SELECT
  company_id, 'tresbe', employee_id,
  opening_vacation_hours, opening_sick_hours,
  opening_vacation_hours, opening_sick_hours,
  0, 0,
  as_of_year, as_of_month
FROM matches
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_leave_ledger_entries ledger
  WHERE ledger.tresbe_employee_id = matches.employee_id
)
ON CONFLICT (tresbe_employee_id) DO UPDATE SET
  vacation_balance_hours = EXCLUDED.vacation_balance_hours,
  sick_balance_hours = EXCLUDED.sick_balance_hours,
  vacation_accrued_lifetime_hours = EXCLUDED.vacation_accrued_lifetime_hours,
  sick_accrued_lifetime_hours = EXCLUDED.sick_accrued_lifetime_hours,
  vacation_used_lifetime_hours = EXCLUDED.vacation_used_lifetime_hours,
  sick_used_lifetime_hours = EXCLUDED.sick_used_lifetime_hours,
  last_replayed_year = EXCLUDED.last_replayed_year,
  last_replayed_month = EXCLUDED.last_replayed_month;
