-- TRESBE budget: add "Publicidad" category (no advertising category existed
-- yet) and load the confirmed Google Ads charge for 2026-09-21. Confirmed
-- by Maria as a legitimate Tresbe business expense, not personal.
-- Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_publicidad uuid;
begin
  insert into tresbe_budget_categories
    (company_id, code, name, kind, total_group, is_financing, sort_order, is_active)
  select v_company_id, 'publicidad', 'Publicidad', 'egreso', 'proveedores_compras', false, 45, true
  where not exists (
    select 1 from tresbe_budget_categories
    where company_id = v_company_id and code = 'publicidad'
  );

  select id into v_publicidad
  from tresbe_budget_categories
  where company_id = v_company_id and code = 'publicidad';

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-21'::date, '2026-09-21'::date, 'egreso', v_publicidad,
    'Publicidad', 'Google G1SK003M', 10.88, 'Banco Popular', null,
    'PURCHASE Google G1SK003M, fecha de compra 09/19/26; confirmado como gasto de Tresbe (advertising), no personal'
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-21'
      and m.category_id = v_publicidad
      and m.amount = 10.88
      and m.account = 'Banco Popular'
  );
end $$;
