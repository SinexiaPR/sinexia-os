-- TRESBE budget: add an "Ajustes/Reversos" category for same-day bank
-- reversals (e.g. an ACH debit the bank returns/reverses same day) that
-- don't fit any existing income category. Widens the categories' kind/group
-- check constraints to allow an 'ingreso' row under a new 'ajustes' group,
-- then inserts the category. Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
begin
  if exists (
    select 1 from tresbe_budget_categories
    where company_id = v_company_id and code = 'ajustes_reversos'
  ) then
    return;
  end if;

  alter table tresbe_budget_categories drop constraint if exists tresbe_budget_categories_group_check;
  alter table tresbe_budget_categories add constraint tresbe_budget_categories_group_check
    check (total_group = any (array[
      'ingresos', 'proveedores_compras', 'nomina', 'payroll_taxes', 'debitos_bancarios',
      'intercompany', 'financiamiento', 'financiamiento_externo', 'transferencia_interna', 'ajustes'
    ]));

  alter table tresbe_budget_categories drop constraint if exists tresbe_budget_categories_group_kind_check;
  alter table tresbe_budget_categories add constraint tresbe_budget_categories_group_kind_check
    check (
      ((kind = 'financiamiento') and (total_group = 'financiamiento'))
      or ((kind = 'intercompany') and (total_group = 'intercompany'))
      or ((kind = 'ingreso') and (total_group = any (array['ingresos', 'ajustes'])))
      or ((kind = 'egreso') and (total_group = any (array['proveedores_compras', 'nomina', 'payroll_taxes', 'debitos_bancarios'])))
      or ((kind = 'financiamiento_externo') and (total_group = 'financiamiento_externo'))
      or ((kind = 'transferencia_interna') and (total_group = 'transferencia_interna'))
    );

  insert into tresbe_budget_categories (company_id, code, name, kind, total_group, flow, sort_order, is_financing)
  values (v_company_id, 'ajustes_reversos', 'Ajustes/Reversos', 'ingreso', 'ajustes', null, 45, false);
end $$;
