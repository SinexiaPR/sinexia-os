-- TRESBE budget: load Oct 6 bank movements (week 7,
-- week_start = 2026-10-05). Two more same-day-returned payments (Mi
-- Contable, Departamento del Trabajo) -- same reversal convention as
-- Planet Home/Bankcard/Banktech: both sides recorded, not netted. No
-- Utilizacion Linea de Credito counterpart since the charge never
-- actually drew on the line (reversed same day). Idempotent per row.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_ajustes uuid := '94dce0da-c032-4fa8-bf22-630181232590';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-10-06'::date, '2026-10-05'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      -- Paso 1: Mi Contable, intentado y devuelto el mismo dia
      ('egreso', v_debitos, 'EFT PMT MI CONTABLE ONLI SERVICES XXXXXXXXXXX1111', 'EFT PMT MI CONTABLE ONLI SERVICES XXXXXXXXXXX1111', 650.00, null::text),
      ('ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'EFT PMT MI CONTABLE ONLI SERVICES XXXXXXXXXXX1111', 650.00, 'Tercer rebote de la semana (Planet Home x2, Banktech, ahora Mi Contable). Linea de reserva al limite ($49.51 disponibles de $25,000).'),

      -- Paso 2: Departamento del Trabajo, intentado y devuelto el mismo dia
      ('egreso', v_debitos, 'EFT PMT Departamento del DEPTRABAJ XXXXXXXXXXX0873', 'EFT PMT Departamento del DEPTRABAJ XXXXXXXXXXX0873', 385.32, null),
      ('ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'EFT PMT Departamento del DEPTRABAJ XXXXXXXXXXX0873', 385.32, 'Cuarto rebote de la semana. Pago a entidad gubernamental (Depto. del Trabajo) -- riesgo de recargos, revisar aparte.')
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-10-06'
      and m.category_id = x.category_id
      and m.direction = x.direction
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
