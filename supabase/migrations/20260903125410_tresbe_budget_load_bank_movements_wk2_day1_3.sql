-- TRESBE budget: load real bank movements for 2026-08-31, 09-01 and 09-02.
--
-- Source: bank export CSVs/xlsx Maria uploaded (Banco Popular checking
-- account), plus the cash sales figures she gave directly ($168.27 on
-- 08-31, $204.94 on 09-01). Only the unambiguous lines are loaded here --
-- 5 checks with no identifiable vendor, 6 bank fee/charge lines, and the
-- "DBD ANGLO BUDGET SIGONFILE" pair (the sheet's own "Revisar" concept)
-- are left out pending clarification from Maria. Idempotent: skips if
-- movements already exist for this date range.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date between '2026-08-31' and '2026-09-02'
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account)
  values
    -- 2026-08-31
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 3241.92, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 2181.93, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_nomina, 'Nomina', 'Cheque 15043', 339.54, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 3884.31, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Cargo Intereses de Reserva', 271.22, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Cargo por Servicio', 10.00, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Cargo por Trans Exceso de 030', 62.00, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Cargo IVU Estatal', 7.56, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Cargo IVU Municipal', 0.72, 'Banco Popular'),
    (v_company_id, '2026-08-31', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'Ventas en efectivo', 168.27, 'Cash / Caja'),
    -- 2026-09-01
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 1652.30, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'egreso', v_debitos, 'Planet Home ACH', 'Planet Home ACH', 2149.11, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 496.81, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1206.09, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 256.75, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 250.00, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 98.12, 'Banco Popular'),
    (v_company_id, '2026-09-01', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'Ventas en efectivo', 204.94, 'Cash / Caja'),
    -- 2026-09-02
    (v_company_id, '2026-09-02', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito Banktech', 1860.82, 'Banco Popular'),
    (v_company_id, '2026-09-02', '2026-08-31', 'egreso', v_nomina, 'Nomina', 'Cheque 15045', 296.93, 'Banco Popular'),
    (v_company_id, '2026-09-02', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 472.27, 'Banco Popular'),
    (v_company_id, '2026-09-02', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1016.55, 'Banco Popular'),
    (v_company_id, '2026-09-02', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 577.27, 'Banco Popular'),
    (v_company_id, '2026-09-02', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 296.93, 'Banco Popular');
end $$;
