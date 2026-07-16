-- Adds the hour categories needed by the leave accrual module that neither
-- payroll system tracks today. These are purely informational inputs to the
-- accrual calculation — they never affect calculatePayrollEntry(),
-- calculate_tresbe_payroll_entry(), or any dollar amount. Any actual pay for
-- a vacation/sick/holiday/jury/bereavement day continues to be entered
-- through the existing other_payments / other_adjustments fields, as today.

ALTER TABLE public.weekly_payroll_entries
  ADD COLUMN IF NOT EXISTS vacation_paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (vacation_paid_hours >= 0),
  ADD COLUMN IF NOT EXISTS sick_paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (sick_paid_hours >= 0),
  ADD COLUMN IF NOT EXISTS holiday_paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (holiday_paid_hours >= 0),
  ADD COLUMN IF NOT EXISTS jury_duty_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (jury_duty_hours >= 0),
  ADD COLUMN IF NOT EXISTS bereavement_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (bereavement_hours >= 0);

ALTER TABLE public.tresbe_payroll_entries
  ADD COLUMN IF NOT EXISTS vacation_paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (vacation_paid_hours >= 0),
  ADD COLUMN IF NOT EXISTS sick_paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (sick_paid_hours >= 0),
  ADD COLUMN IF NOT EXISTS holiday_paid_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (holiday_paid_hours >= 0),
  ADD COLUMN IF NOT EXISTS jury_duty_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (jury_duty_hours >= 0),
  ADD COLUMN IF NOT EXISTS bereavement_hours NUMERIC(8,2) NOT NULL DEFAULT 0
    CHECK (bereavement_hours >= 0);
