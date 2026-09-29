-- TRESBE budget: load Cash Disponible sales for 09-23, 09-24, 09-25 and
-- 09-27 (week 5), confirmed against Clover Sales Report tender-type
-- breakdowns. 09-21 and 09-22 were already loaded. 09-26 is
-- intentionally NOT loaded -- no Clover Sales Report exists for that
-- day; never assume $0 for a missing day. Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, '2026-09-21'::date, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', x.amount, 'Cash / Caja', null, null
  from (
    values
      ('2026-09-23'::date, 58.26),
      ('2026-09-24'::date, 36.20),
      ('2026-09-25'::date, 22.34),
      ('2026-09-27'::date, 4.55)
  ) as x(entry_date, amount)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date
      and m.category_id = v_cash
      and m.amount = x.amount
      and m.account = 'Cash / Caja'
  );
end $$;
