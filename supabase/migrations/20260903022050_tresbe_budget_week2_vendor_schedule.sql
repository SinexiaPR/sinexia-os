-- TRESBE budget: load the recurring vendor schedule (Proveedores 13W) and
-- correct the recurring bank debits (Debitos Bancarios 13W) so that
-- generateWeeklyBudget() reproduces the Modelo Maestro's week 2 forecast.
--
-- Vendor schedule amounts are the day-level totals per column (Proveedores
-- activos / Recurrentes al dia / Compras mercaderia cash-reembolso) from the
-- "Proveedores 13W" sheet -- that is the finest grain the sheet itself
-- carries (it lists vendor names per day but never splits the day total
-- between them), and the same pattern repeats identically across all 13
-- weeks. Idempotent: skips if TRESBE already has vendor schedule rows.

do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_proveedores uuid := 'e290714a-3820-4e12-bd5b-3f1b7ddaa603';
  v_recurrentes uuid := '01739a70-5fba-4001-81d4-17b1d0bc7cab';
  v_reembolsos uuid := '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3';
begin
  if exists (
    select 1 from tresbe_budget_vendor_schedule where company_id = v_company_id
  ) then
    return;
  end if;

  insert into tresbe_budget_vendor_schedule
    (company_id, vendor_name, vendor_type, category_id, weekday, amount, is_active)
  values
    (v_company_id, 'OL DIESEL', 'recurrente_al_dia', v_recurrentes, 1, 30.63, true),
    (v_company_id, 'ALBERTO CHAVES', 'proveedor_activo', v_proveedores, 2, 41.39, true),
    (v_company_id, 'SINERGIA LLC', 'recurrente_al_dia', v_recurrentes, 2, 266.30, true),
    (v_company_id, 'HECTOR ANGULO, ANGEL DIAZ, CHARLIE''S PLUMBING LLC, CHRISTOPHER PADILLA',
      'recurrente_al_dia', v_recurrentes, 3, 336.58, true),
    (v_company_id, 'BALLESTER HERMANOS, COSERA, AR TE LLC, FRIGORIFICO VALLEJO INC, GUSTOS COFFEE CO, CARIBE COMPOSTABLE, LAS LOMAS, TAXCO BAKERY Y GRILL, FINCA CARIBE, EMPRESAS DE GAS, NESTOR MORALES (+1 mas)',
      'proveedor_activo', v_proveedores, 4, 4516.00, true),
    (v_company_id, 'JESSICA SANCHEZ TRINIDAD, ANA PEREZ, MARIA L CABRERA, PHP PEST CONTROL, LUXOWINE LLC, LOIZA DARK, AMORA CAMACHO MENDEZ, TRANSAMERICA AGENCIES COMPANY INC, GIL DE LOS SANTOS, MISAEL VALLE (+1 mas)',
      'recurrente_al_dia', v_recurrentes, 4, 905.85, true),
    (v_company_id, 'FERNANDO ALMONTE, CASH - COMPRAS EN EFECTIVO, JOEL BRAUER, ADALBERTO CUADRADO SUAREZ, ALFREDO SALGADO',
      'compra_mercaderia_cash', v_reembolsos, 4, 2013.75, true),
    (v_company_id, 'DESECHABLES PR LLC, SEAWORLD, MARTA GARRAUS, DOCKSIDE', 'proveedor_activo', v_proveedores, 5, 1091.58, true),
    (v_company_id, 'LA NUMERO 12 LLC, AGUSTIN POLANCO, SANTURCE BREWING INC, TRUE WASTE, OMAR CONCEPCION',
      'recurrente_al_dia', v_recurrentes, 5, 284.76, true),
    (v_company_id, 'JUAN CARLOS BERRIOS SANTINI', 'compra_mercaderia_cash', v_reembolsos, 5, 10.06, true);
end $$;

-- Debitos Bancarios 13W corrections: Planet Home ACH and the 3 Speed Fiber
-- lines fire in week 2 (day-of-month 1 and 3, both shifted to the next
-- Monday when they land on a weekend); Mi Contable Online (day 4) was
-- missing entirely. AAA and the Banco Popular Prestamo x9001 installment
-- were mismarked "semanal" -- the sheet shows they actually recur monthly
-- (day 25 and day 23 respectively, shifted to the next Monday on a
-- weekend), so marking them weekly was about to duplicate them into every
-- future week including week 2, where the sheet has neither.

update tresbe_budget_recurring_debits
set is_active = true,
    amount = 2149.11,
    classification = 'Financiamiento / ACH',
    frequency = 'mensual',
    weekday = null,
    day_of_month = 1,
    weekend_shift = 'lunes_siguiente',
    confidence = 'alta'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'Planet Home ACH';

update tresbe_budget_recurring_debits
set concept = 'Speed Fiber - Azucena',
    is_active = true,
    amount = 149.97,
    classification = 'Telecomunicaciones',
    frequency = 'mensual',
    weekday = null,
    day_of_month = 3,
    weekend_shift = 'lunes_siguiente',
    confidence = 'alta'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'Speed Fiber 1';

update tresbe_budget_recurring_debits
set concept = 'Speed Fiber - Tres B Calle L',
    is_active = true,
    amount = 169.97,
    classification = 'Telecomunicaciones',
    frequency = 'mensual',
    weekday = null,
    day_of_month = 3,
    weekend_shift = 'lunes_siguiente',
    confidence = 'alta'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'Speed Fiber 2';

update tresbe_budget_recurring_debits
set concept = 'Speed Fiber - Tresbe Inc',
    is_active = true,
    amount = 569.91,
    classification = 'Telecomunicaciones',
    frequency = 'mensual',
    weekday = null,
    day_of_month = 3,
    weekend_shift = 'lunes_siguiente',
    confidence = 'alta'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'Speed Fiber 3';

update tresbe_budget_recurring_debits
set is_active = true,
    amount = 600.00,
    classification = 'Servicios profesionales',
    frequency = 'mensual',
    weekday = null,
    day_of_month = 4,
    weekend_shift = 'lunes_siguiente',
    confidence = 'media'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'Mi Contable Online';

update tresbe_budget_recurring_debits
set frequency = 'mensual',
    weekday = null,
    day_of_month = 25,
    weekend_shift = 'lunes_siguiente'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'AAA';

update tresbe_budget_recurring_debits
set frequency = 'mensual',
    weekday = null,
    day_of_month = 23,
    weekend_shift = 'lunes_siguiente'
where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and concept = 'Préstamo Banco Popular x9001';
