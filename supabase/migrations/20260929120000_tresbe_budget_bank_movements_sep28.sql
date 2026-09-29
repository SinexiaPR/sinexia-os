-- TRESBE budget: load real bank movements for 2026-09-28, the first
-- day of week 6. Sep 22-25 items from this ticket were already loaded
-- in prior sessions (including the Joel Brauer -> Nomina correction)
-- and are skipped here. Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-28'::date, '2026-09-28'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 425.59, null::text),
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 404.75, null),
      ('egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 539.86, null),
      ('egreso', v_nomina, 'Nomina', 'Gustavo G Samot - Cheque #15100', 290.48, 'Confirmado por captura de Ver Transacciones; coincide con reporte de cheques pendientes previo')
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-28'
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
