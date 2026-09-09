-- TRESBE budget: load real bank movements for 2026-09-05 through 2026-09-08,
-- transcribed from Maria's own categorization in the Modelo Maestro's
-- "Movimientos Reales" tab (week 2 finishes on 09-06; 09-07/09-08 are the
-- first two days of week 3). Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date in ('2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08')
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account)
  values
    (v_company_id, '2026-09-05', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'VENTAS CASH', 142.74, 'Cash / Caja'),
    (v_company_id, '2026-09-06', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'VENTAS CASH', 52.98, 'Cash / Caja'),
    (v_company_id, '2026-09-07', '2026-09-07', 'ingreso', v_cash, 'Ventas', 'VENTAS CASH', 24.88, 'Cash / Caja'),
    (v_company_id, '2026-09-08', '2026-09-07', 'ingreso', v_credit_card, 'Ventas', 'Deposito clover', 4382.65, 'Banco Popular'),
    (v_company_id, '2026-09-08', '2026-09-07', 'ingreso', v_credit_card, 'Ventas', 'Deposito clover', 610.29, 'Banco Popular'),
    (v_company_id, '2026-09-08', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Paola Negron - 15038', 131.45, 'Banco Popular'),
    (v_company_id, '2026-09-08', '2026-09-07', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 4861.49, 'Banco Popular');
end $$;
