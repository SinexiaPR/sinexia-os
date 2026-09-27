-- TRESBE budget: reclassify cheques #20696 ($73.75) and #20717
-- ($50.94), both 2026-09-23, Joel Brauer, from Proveedores to Nomina.
-- Maria confirmed Joel Brauer is payroll -- consistent with the
-- existing 2026-08-26 Nomina row for "Joel Brauer Cardin" and cheque
-- #20721, already loaded correctly as Nomina. Idempotent.
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
    and entry_date = '2026-09-23'
    and direction = 'egreso'
    and category_id = v_proveedores
    and counterparty in ('Joel Brauer - Cheque #20696', 'Joel Brauer - Cheque #20717');
end $$;
