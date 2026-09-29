-- TRESBE budget: mark 2026-09-26 (Saturday) as closed for Cash
-- Disponible -- Marieeta confirmed TRESBE did not open that day. This
-- is a real $0, not a missing load, so it goes in
-- tresbe_budget_closed_days (movements.amount requires > 0) rather
-- than as a zero-amount movement. Idempotent via the table's unique
-- constraint.
insert into tresbe_budget_closed_days (company_id, entry_date, category_id, note)
values (
  '039a6f05-0dc7-43ac-9799-70011a3dbcd1',
  '2026-09-26',
  '613b497d-844f-4497-a4d9-f01ecdefee6e',
  'TRESBE cerrado, sin operaciones'
)
on conflict (company_id, entry_date, category_id) do nothing;
