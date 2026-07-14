-- Add the explicit hourly rule in its own transaction. PostgreSQL enum values
-- cannot be used safely by data statements until the ALTER TYPE commits.
ALTER TYPE public.tresbe_payroll_rule
  ADD VALUE IF NOT EXISTS 'preset_40_hourly'
  AFTER 'standard_hourly_40_plus_services';
