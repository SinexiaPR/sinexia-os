-- TRESBE budget: fix cheque #20709's counterparty name -- Maria
-- confirmed the beneficiary is "Sinergia LLC" (an existing recurring
-- vendor already in the vendor schedule), not "Sinexia LLC" as
-- recorded earlier. Category (Recurrentes) was already correct, so
-- this only corrects the name; no new row, no duplicate. Idempotent.
update tresbe_budget_movements
set counterparty = 'Sinergia LLC - Cheque #20709'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1'
  and entry_date = '2026-09-22'
  and direction = 'egreso'
  and amount = 300.00
  and counterparty = 'Sinexia LLC - Cheque #20709';
