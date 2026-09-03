-- TRESBE budget: revert the credit line opening balance to -23015.78.
--
-- PR #60 changed this from -23015.78 to -22910.88 to make week 2's rolled
-- forward opening match the Modelo Maestro's manually typed anchor
-- (-22963.33). That diagnosis was wrong: -23015.78 was already correct
-- (it's what scripts/test-tresbe-budget.ts had asserted all along); the
-- real bug was a flipped sign in creditLineClosing/getOpeningBalances,
-- which used the bank's own cash-flow sign (+utilización -repago) for the
-- credit line's own balance instead of its liability sign
-- (+repago -utilización). Fixed alongside this migration in
-- calculations.ts and services/tresbe-budget.ts. With -23015.78 restored
-- and the sign corrected, week 2's opening still rolls forward to exactly
-- -22963.33.
update tresbe_budget_settings
set credit_line_opening_balance = -23015.78
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
