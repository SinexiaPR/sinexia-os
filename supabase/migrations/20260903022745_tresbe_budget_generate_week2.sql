-- TRESBE budget: generate week 2 (2026-08-31) Presupuesto entries.
--
-- This is the exact output of buildForecastForWeek() for week 2 once the
-- vendor schedule, recurring debits and weekend sales pattern corrections
-- from the two preceding migrations are in place -- equivalent to calling
-- the generateWeeklyBudget server action, replicated here as SQL since that
-- action requires an authenticated request context. Idempotent: skips if
-- week 2 already has entries.
insert into tresbe_budget_entries
  (company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
select * from (values
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1'::uuid, '2026-08-31'::date, '2026-08-31'::date, '01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, 30.63, 'calculado'::tresbe_budget_origin, 'OL DIESEL', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-08-31', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 212.61, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-08-31', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 1634.83, 'calculado', 'Ventas con tarjeta del 2026-08-28 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-01', '2026-08-31', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 266.30, 'calculado', 'SINERGIA LLC', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-01', '2026-08-31', '399e8380-c529-4ec1-83d8-636560f29d1f', 2149.11, 'calculado', 'Planet Home ACH', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-01', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 167.96, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-01', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 1839.29, 'calculado', 'Ventas con tarjeta del 2026-08-29 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-01', '2026-08-31', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 41.39, 'calculado', 'ALBERTO CHAVES', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-02', '2026-08-31', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 336.58, 'calculado', 'HECTOR ANGULO, ANGEL DIAZ, CHARLIE''S PLUMBING LLC, CHRISTOPHER PADILLA', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-02', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 189.98, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-02', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 207.66, 'calculado', 'Ventas con tarjeta del 2026-08-30 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-02', '2026-08-31', 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0', 7857.25, 'calculado', 'Nómina proyectada', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 905.85, 'calculado', 'JESSICA SANCHEZ TRINIDAD, ANA PEREZ, MARIA L CABRERA, PHP PEST CONTROL, LUXOWINE LLC, LOIZA DARK, AMORA CAMACHO MENDEZ, TRANSAMERICA AGENCIES COMPANY INC, GIL DE LOS SANTOS, MISAEL VALLE (+1 mas)', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3', 2013.75, 'calculado', 'FERNANDO ALMONTE, CASH - COMPRAS EN EFECTIVO, JOEL BRAUER, ADALBERTO CUADRADO SUAREZ, ALFREDO SALGADO', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', '399e8380-c529-4ec1-83d8-636560f29d1f', 1079.85, 'calculado', 'Payroll Billing · Speed Fiber - Azucena · Speed Fiber - Tres B Calle L · Speed Fiber - Tresbe Inc', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 99.30, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 2249.28, 'calculado', 'Ventas con tarjeta del 2026-08-31 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', 'cb6dd059-3d07-4463-bead-1c6765dd528b', 1776.52, 'calculado', 'Payroll tax sobre la nómina de la semana', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-03', '2026-08-31', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 4516.00, 'calculado', 'BALLESTER HERMANOS, COSERA, AR TE LLC, FRIGORIFICO VALLEJO INC, GUSTOS COFFEE CO, CARIBE COMPOSTABLE, LAS LOMAS, TAXCO BAKERY Y GRILL, FINCA CARIBE, EMPRESAS DE GAS, NESTOR MORALES (+1 mas)', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-04', '2026-08-31', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 284.76, 'calculado', 'LA NUMERO 12 LLC, AGUSTIN POLANCO, SANTURCE BREWING INC, TRUE WASTE, OMAR CONCEPCION', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-04', '2026-08-31', '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3', 10.06, 'calculado', 'JUAN CARLOS BERRIOS SANTINI', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-04', '2026-08-31', '399e8380-c529-4ec1-83d8-636560f29d1f', 600.00, 'calculado', 'Mi Contable Online', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-04', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 154.53, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-04', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 1776.90, 'calculado', 'Ventas con tarjeta del 2026-09-01 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-04', '2026-08-31', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 1091.58, 'calculado', 'DESECHABLES PR LLC, SEAWORLD, MARTA GARRAUS, DOCKSIDE', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-05', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 173.86, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-05', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 2009.89, 'calculado', 'Ventas con tarjeta del 2026-09-02 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-06', '2026-08-31', '613b497d-844f-4497-a4d9-f01ecdefee6e', 19.63, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-06', '2026-08-31', 'c3abb98b-b913-4572-a929-112750306178', 1050.51, 'calculado', 'Ventas con tarjeta del 2026-09-03 netas de comisión y retención', now())
) as v(company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
where not exists (
  select 1 from tresbe_budget_entries
  where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and week_start = '2026-08-31'
);
