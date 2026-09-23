-- TRESBE budget: reclassify cheque #20709 (2026-09-22, $300.00, Sinexia
-- LLC). Maria corrected the earlier categorization -- it is not an
-- intercompany movement, it's a Recurrentes expense. Move it to the
-- Recurrentes category and clear counterparty_id (only intercompany
-- movements carry a counterparty reference). Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_intercompany_entregado uuid := '69657a95-f3cb-4b7d-b93a-3daa71f5d0b6';
  v_recurrentes uuid := '01739a70-5fba-4001-81d4-17b1d0bc7cab';
begin
  update tresbe_budget_movements
  set category_id = v_recurrentes,
      concept = 'Recurrentes',
      counterparty_id = null
  where company_id = v_company_id
    and entry_date = '2026-09-22'
    and direction = 'egreso'
    and category_id = v_intercompany_entregado
    and amount = 300.00
    and account = 'Banco Popular';
end $$;
