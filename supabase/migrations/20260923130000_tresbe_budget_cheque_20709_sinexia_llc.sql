-- TRESBE budget: load cheque #20709 (2026-09-22, $300.00), confirmed by
-- Maria as paid to Sinexia LLC -- an intercompany egreso, same treatment
-- as prior Grupo Sibarita LLC / Lado Ce LLC intercompany checks.
-- Intercompany movements require a counterparty row; none existed for
-- Sinexia LLC yet, so it is created here too. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_intercompany_entregado uuid := '69657a95-f3cb-4b7d-b93a-3daa71f5d0b6';
  v_sinexia_llc uuid;
begin
  insert into tresbe_budget_counterparties (company_id, name)
  select v_company_id, 'SINEXIA LLC'
  where not exists (
    select 1 from tresbe_budget_counterparties
    where company_id = v_company_id and name = 'SINEXIA LLC'
  );

  select id into v_sinexia_llc
  from tresbe_budget_counterparties
  where company_id = v_company_id and name = 'SINEXIA LLC';

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-22'::date, '2026-09-21'::date, 'egreso', v_intercompany_entregado,
    'Intercompany', 'Sinexia LLC - Cheque #20709', 300.00, 'Banco Popular', v_sinexia_llc, null
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-22'
      and m.category_id = v_intercompany_entregado
      and m.amount = 300.00
      and m.account = 'Banco Popular'
  );
end $$;
