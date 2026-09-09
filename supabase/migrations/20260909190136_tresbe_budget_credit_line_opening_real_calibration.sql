-- TRESBE budget: calibrate the credit line opening balance against a real
-- Banco Popular balance Maria confirmed as of today (2026-09-09): Balance
-- adeudado = $19,930.31. Every movement from 2026-08-24 through 2026-09-08
-- has already been independently verified against the Modelo Maestro's own
-- "Seguimiento Diario" tab (week 1 and week 2 both matched exactly), so the
-- gap between our calculated line balance (-$29,653.29 through 09-08) and
-- the real one (-$19,930.31) was entirely in the opening anchor itself --
-- -23015.78 was never checked against an actual bank balance before now,
-- only against the sheet's own internal week-2 anchor (which this doesn't
-- change: the anchor still exists purely to roll movements forward).
-- Solved backwards: -23015.78 + ($29,653.29 - $19,930.31) = -13292.80.
update tresbe_budget_settings
set credit_line_opening_balance = -13292.80
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
