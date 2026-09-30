-- TRESBE budget: load real bank movements for 2026-09-29 (week 6).
-- Cheque #20719 (Sinergia LLC, $300.00) is confirmed by the physical
-- check image; dated 2026-09-29 per the bank's actual debit date
-- (statement/effective date), not the 09-22 issue date on the check
-- itself -- same convention used for every other check. Idempotent
-- per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-09-29'::date, '2026-09-28'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 390.59, null::text),
      ('egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 90.59, null),
      ('egreso', v_proveedores, 'Pago a proveedor', 'Sinergia LLC - Cheque #20719', 300.00, 'Confirmado por imagen del cheque fisico; cheque emitido 09-22 pero debitado por el banco el 09-29')
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-09-29'
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
