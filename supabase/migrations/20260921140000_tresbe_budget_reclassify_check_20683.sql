-- TRESBE budget: load Cheque #20683 ($600.00, 09-18), confirmed by Maria
-- as Gustos Coffee Co (a vendor) -- Proveedores, not Nomina. It bounced
-- and reversed the same day, so loaded as a pair like Cheque #15096 in
-- the prior migration. Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_ajustes uuid := '94dce0da-c032-4fa8-bf22-630181232590';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, x.direction, x.category_id, x.concept, x.counterparty, x.amount, x.account, null, x.note
  from (
    values
      ('2026-09-18'::date, '2026-09-14'::date, 'egreso', v_proveedores, 'Suplidor', 'Gustos Coffee Co - Cheque #20683', 600.00, 'Banco Popular', null::text),
      ('2026-09-18'::date, '2026-09-14'::date, 'ingreso', v_ajustes, 'Cheque Devuelto SF', 'Cheque #20683', 600.00, 'Banco Popular', 'Cheque devuelto el mismo dia')
  ) as x(entry_date, week_start, direction, category_id, concept, counterparty, amount, account, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = x.account
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
