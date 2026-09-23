-- TRESBE budget: correct + load Cash Disponible per Clover daily sales
-- reports for Sep 20-22, 2026.
--
-- The $68.53 cash figure previously loaded under entry_date 2026-09-21
-- (from a verbal "21 de septiembre Cash $68.53") is actually Sep 20's
-- business-day total per Clover's own report (window Sun 12:00 AM -
-- Mon 2:00 AM, all $797.52 gross sales landing in the Sep 20 column,
-- $0.00 in Sep 21). Reassigned here to entry_date 2026-09-20 /
-- week_start 2026-09-14 (last day of week 4).
--
-- The real Sep 21 cash ($12.80) and Sep 22 cash ($40.25) are loaded
-- fresh from their own Clover reports. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
begin
  update tresbe_budget_movements
  set entry_date = '2026-09-20',
      week_start = '2026-09-14'
  where company_id = v_company_id
    and category_id = v_cash
    and entry_date = '2026-09-21'
    and amount = 68.53
    and account = 'Cash / Caja';

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, 'ingreso', v_cash, 'Ventas', 'Ventas Cash', x.amount, 'Cash / Caja', null, null
  from (
    values
      ('2026-09-21'::date, '2026-09-21'::date, 12.80),
      ('2026-09-22'::date, '2026-09-21'::date, 40.25)
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
