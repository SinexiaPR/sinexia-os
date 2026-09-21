-- TRESBE budget: load Cash Disponible sales for 09-17 through 09-19
-- (week 4) and 09-21 (week 5's Monday), given directly by Maria (cash
-- sales are manual, not pulled from the bank feed). Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', x.amount, 'Cash / Caja', null, null
  from (
    values
      ('2026-09-17'::date, '2026-09-14'::date, 93.86),
      ('2026-09-18'::date, '2026-09-14'::date, 54.92),
      ('2026-09-19'::date, '2026-09-14'::date, 42.86),
      ('2026-09-21'::date, '2026-09-21'::date, 68.53)
  ) as x(entry_date, week_start, amount)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date
      and m.category_id = v_cash
      and m.amount = x.amount
      and m.account = 'Cash / Caja'
  );
end $$;
