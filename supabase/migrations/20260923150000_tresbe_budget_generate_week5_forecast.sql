-- TRESBE budget: generate the week 5 (2026-09-21) forecast/"supuestos"
-- from the configured assumptions. The "Generar presupuesto" button in
-- the UI is non-functional (see prior week 4 workaround), so this
-- replicates generateWeeklyBudget()'s server-action logic: run
-- buildForecastForWeek() with the real settings/sales pattern/recurring
-- debits/vendor schedule, then upsert the results as origin='calculado'
-- entries. No manual cells exist yet for this week, so nothing is
-- preserved/skipped. Idempotent via upsert on (company_id, entry_date,
-- category_id).
insert into tresbe_budget_entries
  (company_id, entry_date, week_start, category_id, amount, origin, note, generated_at)
select
  '039a6f05-0dc7-43ac-9799-70011a3dbcd1'::uuid, x.entry_date, '2026-09-21'::date, x.category_id, x.amount, 'calculado', x.note, now()
from (
  values
    ('01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, '2026-09-21'::date, 30.63, 'OL DIESEL'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-21'::date, 212.61, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-21'::date, 1634.83, 'Ventas con tarjeta del 2026-09-18 netas de comisión y retención'),
    ('01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, '2026-09-22'::date, 266.3, 'SINERGIA LLC'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-22'::date, 167.96, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-22'::date, 1839.29, 'Ventas con tarjeta del 2026-09-19 netas de comisión y retención'),
    ('e290714a-3820-4e12-bd5b-3f1b7ddaa603'::uuid, '2026-09-22'::date, 41.39, 'ALBERTO CHAVES'),
    ('01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, '2026-09-23'::date, 336.58, 'HECTOR ANGULO, ANGEL DIAZ, CHARLIE''S PLUMBING LLC, CHRISTOPHER PADILLA'),
    ('399e8380-c529-4ec1-83d8-636560f29d1f'::uuid, '2026-09-23'::date, 553.44, 'Préstamo Banco Popular x9001'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-23'::date, 189.98, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-23'::date, 207.66, 'Ventas con tarjeta del 2026-09-20 netas de comisión y retención'),
    ('cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0'::uuid, '2026-09-23'::date, 7857.25, 'Nómina proyectada'),
    ('01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, '2026-09-24'::date, 905.85, 'JESSICA SANCHEZ TRINIDAD, ANA PEREZ, MARIA L CABRERA, PHP PEST CONTROL, LUXOWINE LLC, LOIZA DARK, AMORA CAMACHO MENDEZ, TRANSAMERICA AGENCIES COMPANY INC, GIL DE LOS SANTOS, MISAEL VALLE (+1 mas)'),
    ('265e41e7-bd8b-4c28-85e6-265dd4a1a7b3'::uuid, '2026-09-24'::date, 2013.75, 'FERNANDO ALMONTE, CASH - COMPRAS EN EFECTIVO, JOEL BRAUER, ADALBERTO CUADRADO SUAREZ, ALFREDO SALGADO'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-24'::date, 99.3, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-24'::date, 2249.28, 'Ventas con tarjeta del 2026-09-21 netas de comisión y retención'),
    ('cb6dd059-3d07-4463-bead-1c6765dd528b'::uuid, '2026-09-24'::date, 1776.52, 'Payroll tax sobre la nómina de la semana'),
    ('cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0'::uuid, '2026-09-24'::date, 190, 'Payroll Billing'),
    ('e290714a-3820-4e12-bd5b-3f1b7ddaa603'::uuid, '2026-09-24'::date, 4516, 'BALLESTER HERMANOS, COSERA, AR TE LLC, FRIGORIFICO VALLEJO INC, GUSTOS COFFEE CO, CARIBE COMPOSTABLE, LAS LOMAS, TAXCO BAKERY Y GRILL, FINCA CARIBE, EMPRESAS DE GAS, NESTOR MORALES (+1 mas)'),
    ('01739a70-5fba-4001-81d4-17b1d0bc7cab'::uuid, '2026-09-25'::date, 284.76, 'LA NUMERO 12 LLC, AGUSTIN POLANCO, SANTURCE BREWING INC, TRUE WASTE, OMAR CONCEPCION'),
    ('265e41e7-bd8b-4c28-85e6-265dd4a1a7b3'::uuid, '2026-09-25'::date, 10.06, 'JUAN CARLOS BERRIOS SANTINI'),
    ('399e8380-c529-4ec1-83d8-636560f29d1f'::uuid, '2026-09-25'::date, 1145.19, 'AAA'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-25'::date, 154.53, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-25'::date, 1776.9, 'Ventas con tarjeta del 2026-09-22 netas de comisión y retención'),
    ('e290714a-3820-4e12-bd5b-3f1b7ddaa603'::uuid, '2026-09-25'::date, 1091.58, 'DESECHABLES PR LLC, SEAWORLD, MARTA GARRAUS, DOCKSIDE'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-26'::date, 173.86, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-26'::date, 2009.89, 'Ventas con tarjeta del 2026-09-23 netas de comisión y retención'),
    ('613b497d-844f-4497-a4d9-f01ecdefee6e'::uuid, '2026-09-27'::date, 19.63, 'Ventas en efectivo'),
    ('c3abb98b-b913-4572-a929-112750306178'::uuid, '2026-09-27'::date, 1050.51, 'Ventas con tarjeta del 2026-09-24 netas de comisión y retención')
) as x(category_id, entry_date, amount, note)
on conflict (company_id, entry_date, category_id) do update
  set amount = excluded.amount,
      origin = excluded.origin,
      note = excluded.note,
      generated_at = excluded.generated_at;
