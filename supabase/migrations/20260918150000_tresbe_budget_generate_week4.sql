-- TRESBE budget: generate week 4 (2026-09-14) Presupuesto entries.
--
-- The "Generar presupuesto de la semana" button in the UI wasn't
-- producing any effect for Maria, so this is the exact output of
-- buildForecastForWeek() for week 4 computed directly from the current
-- assumptions (settings, sales pattern, recurring debits, vendor
-- schedule) in Supabase -- equivalent to what generateWeeklyBudget would
-- have written, replicated here as SQL since that action requires an
-- authenticated request context, same approach as the week-3 migration.
--
-- The recurring debits/vendor schedule repeat identically every week (by
-- design, same as the original spreadsheet), so the per-category totals
-- match week 3's exactly except Debitos Bancarios: week 4 only lands the
-- weekly Payroll Billing ($190) -- none of the monthly debits'
-- day-of-month falls inside 09/14-09/20 (AEE's the 20th, a Sunday, shifts
-- to the following Monday the 21st, outside this week). Idempotent:
-- skips if week 4 already has entries.
insert into tresbe_budget_entries
  (company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
select * from (values
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1'::uuid, '2026-09-14'::date, '2026-09-14'::date, '01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, 30.63, 'calculado'::tresbe_budget_origin, 'OL DIESEL', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-14', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 212.61, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-14', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 1634.83, 'calculado', 'Ventas con tarjeta del 2026-09-11 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-15', '2026-09-14', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 266.30, 'calculado', 'SINERGIA LLC', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-15', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 167.96, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-15', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 1839.29, 'calculado', 'Ventas con tarjeta del 2026-09-12 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-15', '2026-09-14', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 41.39, 'calculado', 'ALBERTO CHAVES', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-16', '2026-09-14', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 336.58, 'calculado', 'HECTOR ANGULO, ANGEL DIAZ, CHARLIE''S PLUMBING LLC, CHRISTOPHER PADILLA', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-16', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 189.98, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-16', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 207.66, 'calculado', 'Ventas con tarjeta del 2026-09-13 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-16', '2026-09-14', 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0', 7857.25, 'calculado', 'Nómina proyectada', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 905.85, 'calculado', 'JESSICA SANCHEZ TRINIDAD, ANA PEREZ, MARIA L CABRERA, PHP PEST CONTROL, LUXOWINE LLC, LOIZA DARK, AMORA CAMACHO MENDEZ, TRANSAMERICA AGENCIES COMPANY INC, GIL DE LOS SANTOS, MISAEL VALLE (+1 mas)', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3', 2013.75, 'calculado', 'FERNANDO ALMONTE, CASH - COMPRAS EN EFECTIVO, JOEL BRAUER, ADALBERTO CUADRADO SUAREZ, ALFREDO SALGADO', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', '399e8380-c529-4ec1-83d8-636560f29d1f', 190.00, 'calculado', 'Payroll Billing', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 99.30, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 2249.28, 'calculado', 'Ventas con tarjeta del 2026-09-14 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', 'cb6dd059-3d07-4463-bead-1c6765dd528b', 1776.52, 'calculado', 'Payroll tax sobre la nómina de la semana', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-17', '2026-09-14', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 4516.00, 'calculado', 'BALLESTER HERMANOS, COSERA, AR TE LLC, FRIGORIFICO VALLEJO INC, GUSTOS COFFEE CO, CARIBE COMPOSTABLE, LAS LOMAS, TAXCO BAKERY Y GRILL, FINCA CARIBE, EMPRESAS DE GAS, NESTOR MORALES (+1 mas)', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-18', '2026-09-14', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 284.76, 'calculado', 'LA NUMERO 12 LLC, AGUSTIN POLANCO, SANTURCE BREWING INC, TRUE WASTE, OMAR CONCEPCION', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-18', '2026-09-14', '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3', 10.06, 'calculado', 'JUAN CARLOS BERRIOS SANTINI', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-18', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 154.53, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-18', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 1776.90, 'calculado', 'Ventas con tarjeta del 2026-09-15 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-18', '2026-09-14', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 1091.58, 'calculado', 'DESECHABLES PR LLC, SEAWORLD, MARTA GARRAUS, DOCKSIDE', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-19', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 173.86, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-19', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 2009.89, 'calculado', 'Ventas con tarjeta del 2026-09-16 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-20', '2026-09-14', '613b497d-844f-4497-a4d9-f01ecdefee6e', 19.63, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-20', '2026-09-14', 'c3abb98b-b913-4572-a929-112750306178', 1050.51, 'calculado', 'Ventas con tarjeta del 2026-09-17 netas de comisión y retención', now())
) as v(company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
where not exists (
  select 1 from tresbe_budget_entries
  where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and week_start = '2026-09-14'
);
