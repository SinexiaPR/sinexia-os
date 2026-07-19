-- Corrects a tier-transition timing bug found in the source spreadsheet
-- used for the Tresbe leave opening-balance import (20260717060000): the
-- spreadsheet applied a new vacation tier one calendar month after the
-- exact hiring anniversary, instead of the same month the anniversary
-- falls in (Ley 180-1998, según enmendada por Ley 4-2017 — verified by
-- recomputing all 284 employees in the source spreadsheet's raw monthly
-- detail through this module's own replayLeaveHistory()). That extra
-- month at the old (lower) tier permanently understated the running
-- vacation balance by exactly 2 hours for every employee who had already
-- crossed one tier boundary within the tracked period. Sick balance is
-- unaffected (flat 8h/month regardless of tier).
--
-- Scoped to the 9 already-loaded active employees confirmed affected
-- (cross-referenced against a recompute of the full 284-employee sheet),
-- and guarded to only touch employees with zero ledger activity so far —
-- if a real payroll has since been processed for one of them, their
-- balance is already correctly ledger-derived and must not be touched
-- here.

WITH corrections(normalized_name, vacation_delta) AS (
  VALUES
    ('adalberto j. cuadrado', 2::numeric),
    ('alondra martinez', 2::numeric),
    ('doel a. acosta', 2::numeric),
    ('fernando almonte', 2::numeric),
    ('jared rivera rodriguez', 2::numeric),
    ('joel brauer cardin', 2::numeric),
    ('marc a. lopez', 2::numeric),
    ('mario ormaza mercado', 2::numeric),
    ('sheila ortiz', 2::numeric)
), targets AS (
  SELECT te.id AS employee_id, c.vacation_delta
  FROM corrections c
  JOIN public.tresbe_employees te
    ON te.is_active
   AND public.is_tresbe_company(te.company_id)
   AND te.normalized_name = c.normalized_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_leave_ledger_entries l
    WHERE l.tresbe_employee_id = te.id
  )
)
UPDATE public.employee_leave_opening_balances eob
SET opening_vacation_hours = eob.opening_vacation_hours + targets.vacation_delta,
    note = coalesce(eob.note || ' ', '') ||
      '(Corregido +' || targets.vacation_delta || 'h: la planilla original aplicaba el cambio de categoría un mes calendario tarde.)'
FROM targets
WHERE eob.tresbe_employee_id = targets.employee_id;

WITH corrections(normalized_name, vacation_delta) AS (
  VALUES
    ('adalberto j. cuadrado', 2::numeric),
    ('alondra martinez', 2::numeric),
    ('doel a. acosta', 2::numeric),
    ('fernando almonte', 2::numeric),
    ('jared rivera rodriguez', 2::numeric),
    ('joel brauer cardin', 2::numeric),
    ('marc a. lopez', 2::numeric),
    ('mario ormaza mercado', 2::numeric),
    ('sheila ortiz', 2::numeric)
), targets AS (
  SELECT te.id AS employee_id, c.vacation_delta
  FROM corrections c
  JOIN public.tresbe_employees te
    ON te.is_active
   AND public.is_tresbe_company(te.company_id)
   AND te.normalized_name = c.normalized_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_leave_ledger_entries l
    WHERE l.tresbe_employee_id = te.id
  )
)
UPDATE public.employee_leave_balances elb
SET vacation_balance_hours = elb.vacation_balance_hours + targets.vacation_delta,
    vacation_accrued_lifetime_hours = elb.vacation_accrued_lifetime_hours + targets.vacation_delta
FROM targets
WHERE elb.tresbe_employee_id = targets.employee_id;
