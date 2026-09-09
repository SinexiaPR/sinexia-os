-- TRESBE budget: load real bank movements for 2026-09-03 and 2026-09-04,
-- transcribed from Maria's own categorization in the Modelo Maestro's
-- "Movimientos Reales" tab. The Speed Fiber - Tresbe Inc ACH charge on
-- 09-04 was reversed same day (EFT PAYMENT DEVUELTO SF) -- recorded as an
-- Ajustes/Reversos income line rather than netting the two against each
-- other, since Sinexia OS movement amounts must be positive. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_recurrentes uuid := '01739a70-5fba-4001-81d4-17b1d0bc7cab';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_payroll_taxes uuid := 'cb6dd059-3d07-4463-bead-1c6765dd528b';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_util uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_ajustes uuid := (select id from tresbe_budget_categories where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and code = 'ajustes_reversos');
begin
  if v_ajustes is null then
    return;
  end if;
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date in ('2026-09-03', '2026-09-04')
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account)
  values
    -- 2026-09-03
    (v_company_id, '2026-09-03', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito clover', 1442.37, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'egreso', v_nomina, 'Nomina', 'Alondra Martinez - 15040', 496.13, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'egreso', v_payroll_taxes, 'Nomina', 'Payroll Taxes', 1319.21, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'egreso', v_nomina, 'Nomina', 'Payroll Billing', 179.00, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'egreso', v_proveedores, 'Mercadería', 'Nestor Morales', 100.00, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'VENTAS CASH', 117.20, 'Cash / Caja'),
    (v_company_id, '2026-09-03', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 372.97, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 179.00, 'Banco Popular'),
    (v_company_id, '2026-09-03', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 100.00, 'Banco Popular'),
    -- 2026-09-04
    (v_company_id, '2026-09-04', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito clover', 2363.09, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'ingreso', v_credit_card, 'Ventas', 'Deposito Door Dash', 25.20, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'egreso', v_recurrentes, 'Mi Contable On Line', 'Mi Contable On Line', 600.00, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'egreso', v_debitos, 'EFT PMT Banktech WEB PMTS', 'EFT PMT Banktech WEB PMTS', 1585.34, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'egreso', v_recurrentes, 'Internet', 'Speed FIber', 169.97, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'egreso', v_recurrentes, 'Internet', 'Speed FIber', 569.91, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'Speed FIber', 569.91, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'egreso', v_nomina, 'Nomina', 'Lee De Jesus Sanchez - 20684', 71.50, 'Banco Popular'),
    (v_company_id, '2026-09-04', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'VENTAS CASH', 52.07, 'Cash / Caja'),
    (v_company_id, '2026-09-04', '2026-08-31', 'ingreso', v_util, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 38.52, 'Banco Popular');
end $$;
