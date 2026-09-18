-- TRESBE budget: recategorize Cheque #20701 ($250.00, cleared 09-14) from
-- Nomina to Proveedores. The accounting system's "Check Printing" screens
-- show check #20701 was issued to SINERGIA LLC, a vendor, not an
-- employee -- the 20xxx series was wrongly assumed to be entirely
-- personal/service checks until this ticket's cross-check against the
-- Payroll Register and Check Printing screens. Idempotent (re-running is
-- a no-op once the row already matches).
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
begin
  update tresbe_budget_movements
  set
    category_id = v_proveedores,
    concept = 'Suplidor',
    counterparty = 'Sinergia LLC - Cheque #20701',
    note = 'Recategorizado de Nomina a Proveedores: Check Printing confirma que el cheque #20701 fue emitido a SINERGIA LLC (suplidor), no a un empleado'
  where company_id = v_company_id
    and entry_date = '2026-09-14'
    and direction = 'egreso'
    and category_id = 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0'
    and concept = 'Nomina'
    and counterparty = 'Cheque #20701'
    and amount = 250.00
    and account = 'Banco Popular';
end $$;
