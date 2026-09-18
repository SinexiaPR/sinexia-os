-- TRESBE budget: load real bank movements for 2026-09-16 and 2026-09-17,
-- verified check-by-check against the Payroll Register de la Nomina #39
-- (periodo 09/08-09/14, pagada 09/16) and the accounting system's "Check
-- Printing" screens (serie 20689-20717) -- the first time individual
-- checks are identified with certainty instead of inferred from amount.
--
-- 2026-09-15's repago ($1,109.33) is already loaded (see the 09-15
-- migration) and intentionally NOT repeated here.
--
-- Cheque #15069 (Fernando Almonte) is payroll from a week before #39, not
-- part of it -- included anyway since it cleared the bank this day.
-- Cheques #15098 (Natalie Rivera) and #15097 (Jared Rivera Rodriguez) are
-- final checks for employees the Nomina #39 register marks "Terminated".
-- "EFT PMT PAYROLLBILLING" is ADP's processing fee, not a payment to an
-- employee, but stays categorized as Nomina per the treatment already
-- used in every prior week. Idempotent per row (not per day), consistent
-- with how overlapping-date loads have been handled since the week-3
-- gap-fill migration.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_payroll_taxes uuid := 'cb6dd059-3d07-4463-bead-1c6765dd528b';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, x.entry_date, x.week_start, x.direction, x.category_id, x.concept, x.counterparty, x.amount, x.account, null, x.note
  from (
    values
      ('2026-09-16'::date, '2026-09-14'::date, 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 1234.06, 'Banco Popular', null::text),
      ('2026-09-16'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Natalie Rivera - 15098', 155.51, 'Banco Popular', 'Empleada dada de baja (Nomina #39: Terminated)'),
      ('2026-09-16'::date, '2026-09-14'::date, 'egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1078.55, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 798.37, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Shaddai Sanchez - 15101', 375.30, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Fernando Almonte - 15069', 600.28, 'Banco Popular', 'Nomina de una semana anterior a la #39'),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 177.21, 'Banco Popular', 'Cubre el neto combinado de Cheque #15101 (Shaddai Sanchez) + Cheque #15069 (Fernando Almonte)'),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Alondra Martinez - 15093', 601.47, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 601.47, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Jared Rivera Rodriguez - 15097', 670.55, 'Banco Popular', 'Empleado dado de baja (Nomina #39: Terminated)'),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 670.55, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Yohamid Rodriguez - 15099', 159.68, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 159.68, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Alondra Martinez - 20712', 54.00, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 54.00, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Jared Rivera Rodriguez - 20714', 20.48, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 20.48, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Ramon Luis Rivera - 20715', 110.00, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 110.00, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_payroll_taxes, 'Nomina', 'Payroll Taxes', 947.73, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 947.73, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Payroll Billing', 162.50, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 162.50, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'egreso', v_nomina, 'Nomina', 'Samuel Canales Lugo - 15089', 167.53, 'Banco Popular', null),
      ('2026-09-17'::date, '2026-09-14'::date, 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 167.53, 'Banco Popular', null)
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
