-- TRESBE budget: load real bank movements for 2026-09-14, transcribed from
-- Banco Popular's "Modo Clasico" transaction list (checking account x7369).
--
-- Two of this day's debits are the REAL clearing of items that bounced on
-- 09-11 and were reversed same-day there (CHEQUE NUMERO 15061, CHEQUE
-- NUMERO 15080, and the EFT PMT Dept de Hacienda PR Tax payment): the
-- 09-11 entries already net to zero via their own Ajustes/Reversos
-- reversal rows, so recording the 09-14 clearing as its own entry_date is
-- the real, distinct, non-duplicate economic event, not a re-recording of
-- the same movement. All checks are Nomina per Maria's standing
-- instruction. Credit card deposits and the account service fee follow
-- the categorization already used for 09-08 through 09-11.
--
-- Unlike prior days, checking ran a real (positive, after the two Clover
-- deposits) balance through the day instead of being swept transaction by
-- transaction, and only the day's net surplus was swept out at close
-- ("FONDOS TRANF A RESERVA", a debit -- same label/direction already used
-- for the 09-09 repago) as a paydown of the reserve line, not a drawdown.
--
-- The whole day nets to exactly $0.00. Verified against Maria's Banco
-- Popular reserve line screenshot for this close: Balance adeudado
-- $23,850.25, Balance disponible en reserva $1,149.75 (= $25,000 limit -
-- $23,850.25) -- matches $-24,848.29 (close of 09-11) + $998.04 (repago
-- of 09-14) = $-23,850.25 exactly.
--
-- Note: TRESBE's week 4 (week_start 2026-09-14) budget/forecast has not
-- been generated in Sinexia OS yet -- only real movements are loaded
-- here, so budget-vs-real reporting for week 4 will be incomplete until
-- that's generated separately. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date = '2026-09-14'
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  values
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_debitos, 'Impuestos', 'EFT PMT Dept de Hacienda PR Tax', 845.24, 'Banco Popular', null, 'Repeticion del pago devuelto el 09-11 (ya revertido ese dia); este es el cobro real'),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #15061', 427.68, 'Banco Popular', null, 'Repeticion del cheque devuelto el 09-11 (ya revertido ese dia); este es el cobro real'),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #15080', 428.47, 'Banco Popular', null, 'Repeticion del cheque devuelto el 09-11 (ya revertido ese dia); este es el cobro real'),
    (v_company_id, '2026-09-14', '2026-09-14', 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 2163.56, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 1637.65, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #15056', 104.80, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #20708', 126.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_debitos, 'Comision Bancaria', 'EFT PMT Comm Svc Fee Aug 26', 10.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #20692', 332.26, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #20701', 250.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_nomina, 'Nomina', 'Cheque #20703', 278.72, 'Banco Popular', null, null),
    (v_company_id, '2026-09-14', '2026-09-14', 'egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 998.04, 'Banco Popular', null, null);
end $$;
