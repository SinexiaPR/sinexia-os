-- TRESBE budget: mark 2026-09-29 as closed for Cash Disponible -- Clover
-- confirms 0 orders / $0 net that day. Same pattern as 09-26: goes in
-- tresbe_budget_closed_days, not a $0 movement (movements.amount
-- requires > 0). Idempotent via the table's unique constraint.
insert into tresbe_budget_closed_days (company_id, entry_date, category_id, note)
values (
  '039a6f05-0dc7-43ac-9799-70011a3dbcd1',
  '2026-09-29',
  '613b497d-844f-4497-a4d9-f01ecdefee6e',
  'TRESBE cerrado, sin operaciones'
)
on conflict (company_id, entry_date, category_id) do nothing;
