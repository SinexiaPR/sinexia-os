-- Maria dropped tresbe_payroll_analysis directly (it held a hand-typed
-- JSON "% sobre venta" analysis that went stale every time the payroll was
-- recalculated or corrected after being pasted in, causing confusion). The
-- PDF's "% de nomina" page is now computed live from tresbe_payroll_entries
-- and tresbe_payroll_daily_entries instead -- see
-- src/lib/tresbe-payroll/area-report.ts. This file tracks the drop in the
-- repo; already applied to production.
DROP TABLE IF EXISTS public.tresbe_payroll_analysis;
