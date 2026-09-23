-- TRESBE budget: reclassify cheque #20713 (2026-09-21, $278.61, Denzel
-- Daniel Hernandez Nieves) from Proveedores to Nomina -- Maria confirmed
-- Denzel is payroll, not a vendor/supplier. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
begin
  update tresbe_budget_movements
  set category_id = v_nomina,
      concept = 'Nomina'
  where company_id = v_company_id
    and entry_date = '2026-09-21'
    and direction = 'egreso'
    and category_id = v_proveedores
    and amount = 278.61
    and counterparty = 'Denzel Daniel Hernandez Nieves - Cheque #20713';
end $$;
