-- TRESBE budget: load real bank movements for 2026-09-23 and 2026-09-24
-- (week 5). Sep 22 items from this ticket were already loaded in prior
-- sessions and are skipped here (Banktech $576.09, repago $276.09).
--
-- Cheque #20709 ($300.00, 2026-09-22) is intentionally NOT touched by
-- this migration -- this ticket attributes it to "Sinergia LLC" /
-- Proveedores, but it is already loaded as "Sinexia LLC" / Recurrentes
-- per an explicit confirmation earlier this session. Conflicting
-- identification of the same check; held pending confirmation, not
-- guessed.
--
-- Utilizacion rows for 09-23 cover the zero-balance sweep needed that
-- day: cheque #20721 ($711.66 portion) and the Banco Popular loan
-- payment on account x9001 ($553.44), matching the day's shortfall
-- (ingresos $289.78 vs egresos $1,554.88). Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
  v_utilizacion uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, '2026-09-21'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      ('ingreso', '2026-09-23'::date, v_credit_card, 'Ventas', 'Deposito Banktech', 289.78, null::text),
      ('ingreso', '2026-09-24'::date, v_credit_card, 'Ventas', 'Deposito Banktech', 378.82, null),
      ('egreso', '2026-09-24'::date, v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 378.82, null),
      ('ingreso', '2026-09-23'::date, v_utilizacion, 'Fondos Transf. Linea Reserva', 'Fondos Transf. Linea Reserva', 711.66, 'Corresponde a cheque #20721'),
      ('ingreso', '2026-09-23'::date, v_utilizacion, 'Fondos Transf. Linea Reserva', 'Fondos Transf. Linea Reserva', 553.44, 'EFT prestamo Banco Popular cuenta x9001'),
      ('egreso', '2026-09-23'::date, v_proveedores, 'Suplidor', 'Joel Brauer - Cheque #20696', 73.75, null),
      ('egreso', '2026-09-23'::date, v_proveedores, 'Suplidor', 'Joel Brauer - Cheque #20717', 50.94, null),
      ('egreso', '2026-09-23'::date, v_nomina, 'Nomina', 'Joel Brauer - Cheque #20721', 876.75, 'Confirmado por Marieeta'),
      ('egreso', '2026-09-23'::date, v_debitos, 'Prestamo', 'Prestamo Banco Popular x9001', 553.44, 'Mismo prestamo que el pago del 10-sep ($2,900.98); distinto al de cuenta x0001 ($367.74 el 15-sep)')
  ) as x(direction, entry_date, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = x.entry_date
      and m.category_id = x.category_id
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
