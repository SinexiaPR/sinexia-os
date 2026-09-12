-- TRESBE budget: load real bank movements for 2026-09-11, transcribed from
-- Banco Popular's "Mi Banco Comercial" transaction detail (checking account
-- x7369). Categorized directly from the raw bank feed rather than the
-- Modelo Maestro (not yet updated for this date):
--
--   - All "CHEQUE NUMERO ..." lines are Nomina, per Maria's own
--     instruction that every check on this statement is payroll.
--   - "EFT DEPOSIT Banktech WEB PMTS" / "EFT DEPOSIT DoorDash" are Credit
--     Card Disponible (Clover / DoorDash sales deposits), matching the
--     categorization already used for the same descriptions on 09-08/09/10.
--   - "EFT PMT CLOVER FEES" and "EFT PMT DEPT DE HACIENDA PR TAX" are
--     Debitos Bancarios (bank/processor debits), matching the convention
--     set for similar one-off EFT debits in the 09-03/04 migration.
--   - "FONDOS TRANSF. LINEA RESERVA" (positive) is Utilizacion Linea de
--     Credito, same as every prior day's sweep funding.
--   - Two checks (15061, 15080) and the Hacienda tax debit were reversed
--     same day ("CHEQUE DEVUELTO SF" / "EFT PAYMENT DEVUELTO SF"); each
--     reversal is recorded as Ajustes/Reversos income rather than netted
--     against the original debit, same convention as the 09-04 Speed
--     Fiber reversal. The bank labels all three reversals "DEVUELTO SF"
--     (its own generic label), including the one that actually reverses
--     the Hacienda tax debit, not a Speed Fiber charge -- flagged REVISAR.
--
-- The whole day nets to exactly $0.00, matching the statement's checking
-- balance. Verified against Maria's Banco Popular reserve line screenshot
-- for this close: Balance adeudado $24,848.29, Balance disponible en
-- reserva $151.71 (= $25,000 limit - $24,848.29) -- matches
-- $-22,678.73 (close of 09-10) - $2,169.56 (net utilizacion of 09-11)
-- = $-24,848.29 exactly. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_ajustes uuid := '94dce0da-c032-4fa8-bf22-630181232590';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date = '2026-09-11'
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  values
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 884.66, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_credit_card, 'Ventas', 'Deposito Door Dash', 65.52, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #15053', 941.22, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #15071', 1103.01, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1094.05, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #20687', 315.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 315.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #20690', 183.92, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 183.92, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_debitos, 'Comisiones Clover', 'EFT PMT Clover Fees', 379.82, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 379.82, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_debitos, 'Impuestos', 'EFT PMT Dept de Hacienda PR Tax', 845.24, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_ajustes, 'EFT Payment Devuelto', 'EFT PMT Dept de Hacienda PR Tax', 845.24, 'Banco Popular', null, 'REVISAR (nota de Claude): el banco etiqueta el reverso "DEVUELTO SF" pero revierte el debito de Hacienda del mismo dia e importe, no un cargo de Speed Fiber'),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #15061', 427.68, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_ajustes, 'Cheque Devuelto SF', 'Cheque #15061', 427.68, 'Banco Popular', null, 'Cheque devuelto el mismo dia'),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #15074', 196.77, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 196.77, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Cheque #15080', 428.47, 'Banco Popular', null, null),
    (v_company_id, '2026-09-11', '2026-09-07', 'ingreso', v_ajustes, 'Cheque Devuelto SF', 'Cheque #15080', 428.47, 'Banco Popular', null, 'Cheque devuelto el mismo dia');
end $$;
