-- TRESBE budget: load real bank movements for 2026-09-22 (S5, Tuesday).
-- Cheque #20709 ($300.00) is intentionally NOT loaded here -- the bank
-- statement does not carry a payee name for it, and categorization is
-- never guessed; it stays pending until Maria confirms who it was paid
-- to. Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-22'::date, '2026-09-21'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 576.09, null::text),
      ('egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 276.09, null)
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-22'
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
