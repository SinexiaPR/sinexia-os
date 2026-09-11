-- TRESBE budget: load real bank movements for 2026-09-10, transcribed from
-- the Modelo Maestro's "Movimientos Reales" tab (the full set of 25 Nómina
-- lines plus Payroll Taxes, Payroll Billing, and the Banco Popular loan
-- debit, each swept same-day against the reserve credit line, plus the
-- day's Credit Card and Cash sales). Idempotent.
--
-- Verified against Maria's Banco Popular online statement for the reserve
-- line as of this close: Balance adeudado $22,678.73, Balance disponible en
-- reserva $2,321.27 (= $25,000 limit - $22,678.73), Total Balance disponible
-- $3,271.45 (= $950.18 checking + $2,321.27 reserve). The resulting
-- tresbe_budget_credit_line_status balance for the week matches exactly:
-- $-13,089.54 (close of 09-09) - $9,589.19 (net utilización of 09-10) =
-- $-22,678.73.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_payroll_taxes uuid := 'cb6dd059-3d07-4463-bead-1c6765dd528b';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date = '2026-09-10'
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  values
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 910.71, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jezaiah L Perez Silvestre - 15005', 179.97, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jezaiah L Perez Silvestre - 15025', 135.48, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jezaiah L Perez Silvestre - 15042', 257.90, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Gustavo G Samot - 15047', 210.75, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Robert J Kearns - 15058', 348.52, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 221.91, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Alondra Martinez - 15059', 650.84, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 650.84, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Gustavo G Samot - 15065', 205.80, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 205.80, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Rocio del Mar Sevilla - 15067', 452.92, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 452.92, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Robert J Kearns - 15076', 201.59, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 201.59, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Alondra Martinez - 15077', 396.60, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 396.60, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jezaiah L Perez Silvestre - 15079', 172.41, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 172.41, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Gustavo G Samot - 15084', 364.22, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 364.22, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Rocio del Mar Sevilla - 15086', 276.25, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 276.25, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Alondra Martinez - 20688', 40.50, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 40.50, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Arnaldo L Santiago Ruiz', 105.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 105.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jesus Alejandro Aguiar - 20695', 292.50, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 292.50, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Ramon Luis RIvera - 20697', 220.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 220.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Valerie VIcente - 20698', 84.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 84.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Yediel Rivera Perez - 20699', 616.24, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 616.24, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Ramon Luis Rivera - 20705', 330.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 330.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Valerie VIcente - 20706', 57.75, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 57.75, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Yediel Rivera Perez - 20707', 97.30, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 97.30, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_payroll_taxes, 'Nomina', 'Payroll Taxes', 1299.05, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1299.05, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Payroll Billing', 184.50, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 184.50, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_debitos, 'Prestamo Banco Popular', 'Prestamo Banco popular', 2900.98, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 2900.98, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Samuel Canales Lugo - 15054', 215.41, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 215.41, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Samuel Canales Lugo - 15072', 203.42, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 203.42, 'Banco Popular', null, null),
    (v_company_id, '2026-09-10', '2026-09-07', 'ingreso', v_cash, 'Ventas', 'VENTAS CASH', 45.15, 'Cash / Caja', null, null);
end $$;
