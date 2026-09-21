-- TRESBE budget: identify the remaining unconfirmed 09-18 checks and fix
-- two mislabeled counterparties.
--
-- Cheque #15087 (Doel A Acosta, $265.27) is the same check that was
-- earlier flagged as pending under "#16087" -- a transcription error on
-- the bank's statement, not a separate check. Loaded fresh here (it was
-- never inserted under either number).
--
-- Cheque #20718 (Amado Velez Candelaria, $366.74) was also pending;
-- now confirmed as Nomina.
--
-- Cheques #15091 and #15095 were already loaded with a generic "Cheque
-- #NNNNN" counterparty (no name was available yet); updated in place now
-- that the Payroll Register identifies them. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, 'egreso', v_nomina, 'Nomina', x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('2026-09-18'::date, '2026-09-14'::date, 'Doel A Acosta - 15087', 265.27, 'Aparecio en el estado de cuenta como "#16087" -- error de transcripcion del banco, mismo cheque'),
      ('2026-09-18'::date, '2026-09-14'::date, 'Amado Velez Candelaria - 20718', 366.74, null)
  ) as x(entry_date, week_start, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date
      and m.category_id = v_nomina
      and m.amount = x.amount
      and m.account = 'Banco Popular'
  );

  update tresbe_budget_movements
  set counterparty = 'Lee J De Jesus Sanchez - 15091'
  where company_id = v_company_id
    and entry_date = '2026-09-18'
    and direction = 'egreso'
    and category_id = v_nomina
    and counterparty = 'Cheque #15091'
    and amount = 82.75;

  update tresbe_budget_movements
  set counterparty = 'Jezaiah L Perez Silvestre - 15095'
  where company_id = v_company_id
    and entry_date = '2026-09-18'
    and direction = 'egreso'
    and category_id = v_nomina
    and counterparty = 'Cheque #15095'
    and amount = 126.03;
end $$;
