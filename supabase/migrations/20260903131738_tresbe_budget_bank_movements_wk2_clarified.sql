-- TRESBE budget: load the bank movements Maria clarified directly in the
-- Modelo Maestro's "Movimientos Reales" tab (checks with a vendor now
-- identified, bank fees/charges, the card processing discount, and the
-- "Anglo Budget" insurance financing pair), plus the cash sales for
-- 2026-09-02 she gave in chat ($116.84). Idempotent: skips if any of
-- these movements already exist (matched by date + concept + amount).
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_recurrentes uuid := '01739a70-5fba-4001-81d4-17b1d0bc7cab';
  v_reembolsos uuid := '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_cash uuid := '613b497d-844f-4497-a4d9-f01ecdefee6e';
begin
  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date = '2026-08-31' and concept = 'Mercadería' and amount = 600.00
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, note)
  values
    -- 2026-08-31
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_proveedores, 'Mercadería', 'Ballester Hermanos', 600.00, 'Banco Popular', null),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_proveedores, 'Mercadería', 'Cosera', 600.00, 'Banco Popular', null),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_debitos, 'Intereses Fondo Reserva', 'Intereses Fondo Reserva', 271.22, 'Banco Popular', null),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_debitos, 'Cargos por servicio', 'Cargo por servicio', 10.00, 'Banco Popular', null),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_debitos, 'Cargo por exceso de 030', 'Banco Popular', 62.00, 'Banco Popular', null),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_debitos, 'Cargo Ivu estatal', 'Cargo Ivu estatal', 7.56, 'Banco Popular', null),
    (v_company_id, '2026-08-31', '2026-08-31', 'egreso', v_debitos, 'Cargo Ivu Municipal', 'Cargo Ivu Municipal', 0.72, 'Banco Popular', null),
    -- 2026-09-01
    (v_company_id, '2026-09-01', '2026-08-31', 'egreso', v_debitos, 'EFT PMT BANKCARD-1572 MTOT DISC XXXXXXXXXXX1761', 'EFT PMT BANKCARD-1572 MTOT DISC XXXXXXXXXXX1761', 1206.09, 'Banco Popular', null),
    (v_company_id, '2026-09-01', '2026-08-31', 'egreso', v_recurrentes, 'Del Gas', 'Del Gas', 256.75, 'Banco Popular', null),
    (v_company_id, '2026-09-01', '2026-08-31', 'egreso', v_recurrentes, 'Sinexia', 'Sinexia', 250.00, 'Banco Popular', null),
    (v_company_id, '2026-09-01', '2026-08-31', 'egreso', v_proveedores, 'Desechables', 'Desechables', 98.12, 'Banco Popular', null),
    -- 2026-09-02
    (v_company_id, '2026-09-02', '2026-08-31', 'egreso', v_nomina, 'Nomina', 'Nashely Jimenez', 273.71, 'Banco Popular', 'Cobro un cheque de nomina de Junio'),
    (v_company_id, '2026-09-02', '2026-08-31', 'egreso', v_reembolsos, 'Mercadería', 'Cash', 900.00, 'Banco Popular', 'Lo cobro Almonte'),
    (v_company_id, '2026-09-02', '2026-08-31', 'egreso', v_reembolsos, 'Mercadería', 'Fernando Almonte', 1159.38, 'Banco Popular', null),
    (v_company_id, '2026-09-02', '2026-08-31', 'egreso', v_debitos, 'Eft PMT Anglo Budget', 'Eft PMT Anglo Budget', 1016.55, 'Banco Popular', 'Seguro'),
    (v_company_id, '2026-09-02', '2026-08-31', 'egreso', v_debitos, 'Eft PMT Anglo Budget', 'Eft PMT Anglo Budget', 577.27, 'Banco Popular', 'Seguro'),
    (v_company_id, '2026-09-02', '2026-08-31', 'ingreso', v_cash, 'Ventas', 'Ventas en efectivo', 116.84, 'Cash / Caja', null);

  -- Cosmetic: match the vendor/employee names Maria filled in for movements
  -- already loaded generically.
  update tresbe_budget_movements
  set counterparty = 'Tamara Perez -15043'
  where company_id = v_company_id and entry_date = '2026-08-31' and category_id = v_nomina and amount = 339.54;

  update tresbe_budget_movements
  set concept = 'Planet Home ACH -4609', counterparty = 'Planet Home ACH -4609'
  where company_id = v_company_id and entry_date = '2026-09-01' and category_id = v_debitos and amount = 2149.11;
end $$;
