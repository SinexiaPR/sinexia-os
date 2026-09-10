-- TRESBE budget: generate week 3 (2026-09-07) Presupuesto entries.
--
-- This is the exact output of buildForecastForWeek() for week 3 with the
-- corrected settings/sales_pattern from the two preceding migrations in
-- place -- equivalent to calling the generateWeeklyBudget server action,
-- replicated here as SQL since that action requires an authenticated
-- request context. Verified against the Modelo Maestro's "CashFlow
-- Presupuesto" week-3 totals (Proveedores $5,648.97, Recurrentes
-- $1,824.12, Reembolsos mercadería $2,023.81, Nómina $7,857.25, Débitos
-- Bancarios $4,485.19, all exact; Credit Card/Cash within a few cents of
-- rounding). Idempotent: skips if week 3 already has entries.
insert into tresbe_budget_entries
  (company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
select * from (values
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1'::uuid, '2026-09-07'::date, '2026-09-07'::date, '01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, 30.63, 'calculado'::tresbe_budget_origin, 'OL DIESEL', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-07', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 212.61, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-07', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 1634.83, 'calculado', 'Ventas con tarjeta del 2026-09-04 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-08', '2026-09-07', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 266.30, 'calculado', 'SINERGIA LLC', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-08', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 167.96, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-08', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 1839.29, 'calculado', 'Ventas con tarjeta del 2026-09-05 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-08', '2026-09-07', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 41.39, 'calculado', 'ALBERTO CHAVES', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-09', '2026-09-07', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 336.58, 'calculado', 'HECTOR ANGULO, ANGEL DIAZ, CHARLIE''S PLUMBING LLC, CHRISTOPHER PADILLA', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-09', '2026-09-07', '399e8380-c529-4ec1-83d8-636560f29d1f', 1177.60, 'calculado', 'Dbd_anglo_cobros Sigonfile', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-09', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 189.98, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-09', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 207.66, 'calculado', 'Ventas con tarjeta del 2026-09-06 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-09', '2026-09-07', 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0', 7857.25, 'calculado', 'Nómina proyectada', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 905.85, 'calculado', 'JESSICA SANCHEZ TRINIDAD, ANA PEREZ, MARIA L CABRERA, PHP PEST CONTROL, LUXOWINE LLC, LOIZA DARK, AMORA CAMACHO MENDEZ, TRANSAMERICA AGENCIES COMPANY INC, GIL DE LOS SANTOS, MISAEL VALLE (+1 mas)', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3', 2013.75, 'calculado', 'FERNANDO ALMONTE, CASH - COMPRAS EN EFECTIVO, JOEL BRAUER, ADALBERTO CUADRADO SUAREZ, ALFREDO SALGADO', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', '399e8380-c529-4ec1-83d8-636560f29d1f', 3090.98, 'calculado', 'Banco Popular Préstamo - cuota mayor · Payroll Billing', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 99.30, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 2249.28, 'calculado', 'Ventas con tarjeta del 2026-09-07 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', 'cb6dd059-3d07-4463-bead-1c6765dd528b', 1776.52, 'calculado', 'Payroll tax sobre la nómina de la semana', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-10', '2026-09-07', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 4516.00, 'calculado', 'BALLESTER HERMANOS, COSERA, AR TE LLC, FRIGORIFICO VALLEJO INC, GUSTOS COFFEE CO, CARIBE COMPOSTABLE, LAS LOMAS, TAXCO BAKERY Y GRILL, FINCA CARIBE, EMPRESAS DE GAS, NESTOR MORALES (+1 mas)', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-11', '2026-09-07', '01739a70-5fba-4001-81d4-17b1d0bc7cab', 284.76, 'calculado', 'LA NUMERO 12 LLC, AGUSTIN POLANCO, SANTURCE BREWING INC, TRUE WASTE, OMAR CONCEPCION', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-11', '2026-09-07', '265e41e7-bd8b-4c28-85e6-265dd4a1a7b3', 10.06, 'calculado', 'JUAN CARLOS BERRIOS SANTINI', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-11', '2026-09-07', '399e8380-c529-4ec1-83d8-636560f29d1f', 216.61, 'calculado', 'Banco Popular Préstamo - cuota menor x0001', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-11', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 154.53, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-11', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 1776.90, 'calculado', 'Ventas con tarjeta del 2026-09-08 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-11', '2026-09-07', 'e290714a-3820-4e12-bd5b-3f1b7ddaa603', 1091.58, 'calculado', 'DESECHABLES PR LLC, SEAWORLD, MARTA GARRAUS, DOCKSIDE', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-12', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 173.86, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-12', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 2009.89, 'calculado', 'Ventas con tarjeta del 2026-09-09 netas de comisión y retención', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-13', '2026-09-07', '613b497d-844f-4497-a4d9-f01ecdefee6e', 19.63, 'calculado', 'Ventas en efectivo', now()),
  ('039a6f05-0dc7-43ac-9799-70011a3dbcd1', '2026-09-13', '2026-09-07', 'c3abb98b-b913-4572-a929-112750306178', 1050.51, 'calculado', 'Ventas con tarjeta del 2026-09-10 netas de comisión y retención', now())
) as v(company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
where not exists (
  select 1 from tresbe_budget_entries
  where company_id = '039a6f05-0dc7-43ac-9799-70011a3dbcd1' and week_start = '2026-09-07'
);
