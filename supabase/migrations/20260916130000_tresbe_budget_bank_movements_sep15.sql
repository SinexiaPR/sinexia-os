-- TRESBE budget: load real movements for 2026-09-15. The three Banco
-- Popular movements come from the Modelo Maestro's "Movimientos Reales"
-- tab; the Cash Disponible sale ($75.98) was given directly by Maria, not
-- yet entered in that sheet (cash sales are manual, not pulled from the
-- bank feed). Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date = '2026-09-15'
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  values
    (v_company_id, '2026-09-15', '2026-09-14', 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 1477.07, 'Banco Popular', null, null),
    (v_company_id, '2026-09-15', '2026-09-14', 'egreso', v_debitos, 'Prestamo Banco Popular', 'Prestamo Banco popular', 367.74, 'Banco Popular', null, null),
    (v_company_id, '2026-09-15', '2026-09-14', 'egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 1109.33, 'Banco Popular', null, null),
    (v_company_id, '2026-09-15', '2026-09-14', 'ingreso', v_cash, 'Ventas', 'Ventas Cash', 75.98, 'Cash / Caja', null, null);
end $$;
