-- TRESBE budget: load real bank movements for 2026-09-21, the first day
-- of week 5. Cash Disponible for this date is already loaded (prior
-- session). Idempotent per row.
--
-- Cheques #15096 (Regino Pizarro, $304.52) and #20683 (Gustos Coffee Co,
-- $600.00) both bounced and reversed on 09-18 (already loaded as
-- net-zero pairs that day) and were re-presented and cleared for real on
-- 09-21 -- recorded here as their own, separate, non-reversed egresos,
-- same treatment as the Sep 11 -> Sep 14 repeat clearings.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-21'::date, '2026-09-21'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1044.86, null::text),
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 1566.70, null),
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 672.17, null),
      ('egreso', v_nomina, 'Nomina', 'Regino Pizarro - 15096', 304.52, 'Reintento del cheque devuelto el 09-18 (ese dia neteo $0); esta vez liquido de verdad'),
      ('egreso', v_proveedores, 'Suplidor', 'Gustos Coffee Co - Cheque #20683', 600.00, 'Reintento del cheque devuelto el 09-18 (ese dia neteo $0); esta vez liquido de verdad'),
      ('egreso', v_proveedores, 'Suplidor', 'Denzel Daniel Hernandez Nieves - Cheque #20713', 278.61, null)
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-21'
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
