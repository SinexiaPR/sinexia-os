-- TRESBE budget: related_cash_out_enabled had drifted to true, which would
-- inflate every future week's Nómina forecast by $1,648.22 (LADO CE LLC's
-- Calle Cerra payroll cash-out -- a reference line for a different
-- company, not a TRESBE expense). Confirmed against the Modelo Maestro's
-- "CashFlow Presupuesto" week 3 Nómina total ($7,857.25, the base payroll
-- amount with nothing added) that it must be false.
update tresbe_budget_settings
set related_cash_out_enabled = false
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
