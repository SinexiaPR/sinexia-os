-- TRESBE budget: load real bank movements for 2026-09-25 (week 5).
-- Sep 22-24 items from this ticket were already loaded in prior
-- sessions and are skipped per Paso 0.
--
-- Utilizacion covers the zero-balance sweep for cheque #20710
-- ($287.77, Sinergia LLC -- Proveedores egreso the reserve had to
-- fund that day). Cheque #15092 (Robert J Kearns, Nomina) confirmed
-- against a check image plus the Payroll Register (pay date
-- 09/16/2026). Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_utilizacion uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-25'::date, '2026-09-21'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 67.46, null::text),
      ('ingreso', v_utilizacion, 'Fondos Transf. Linea Reserva', 'Fondos Transf. Linea Reserva', 287.77, 'Corresponde a cheque #20710'),
      ('egreso', v_proveedores, 'Suplidor', 'Sinergia LLC - Cheque #20710', 300.00, null),
      ('egreso', v_nomina, 'Nomina', 'Robert J Kearns - Cheque #15092', 55.23, 'Confirmado con imagen del cheque; coincide con Payroll Register (pay date 09/16/2026)')
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-25'
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
