-- A weekly pay period that crosses a calendar month boundary now produces
-- up to 2 ledger rows per payroll entry (one per month, hours prorated by
-- calendar day — see splitHoursAcrossMonths in calculations.ts), instead of
-- attributing 100% of the week to the month of week_end. Widens the
-- ledger's uniqueness from "one row per entry" to "one row per entry per
-- month" so both rows can coexist without violating the constraint that
-- made re-processing the same payroll idempotent.

DROP INDEX IF EXISTS employee_leave_ledger_sibarita_uq;
DROP INDEX IF EXISTS employee_leave_ledger_tresbe_uq;

CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_ledger_sibarita_uq
  ON public.employee_leave_ledger_entries(sibarita_entry_id, period_year, period_month);
CREATE UNIQUE INDEX IF NOT EXISTS employee_leave_ledger_tresbe_uq
  ON public.employee_leave_ledger_entries(tresbe_entry_id, period_year, period_month);
