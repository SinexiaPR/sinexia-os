-- TRESBE budget: load Oct 5 bank movements. Oct 5 is a Monday, so it
-- starts week 7 (week_start = 2026-10-05), not week 6 as assumed in the
-- prompt that requested this load -- the table's own
-- set_tresbe_budget_week_start() trigger derives week_start from
-- entry_date on insert regardless of what's passed here, so the data is
-- correctly bucketed either way; this literal is kept accurate for
-- anyone reading the migration later. Idempotent per row.
--
-- The two Uber charges use Debitos Bancarios as a TEMPORARY category --
-- there is no precedent for an Uber charge in this ledger and no
-- category clearly fits (not a known recurring vendor, not a confirmed
-- supplier). Flagged for Maria to confirm/recategorize; see the note on
-- each row and the PR description.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_debitos uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
  v_utilizacion uuid := 'b1882714-4bd9-4a5c-92b7-2a891261848f';
  v_ajustes uuid := '94dce0da-c032-4fa8-bf22-630181232590';
  v_uber_pending uuid := '399e8380-c529-4ec1-83d8-636560f29d1f';
begin
  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  select
    v_company_id, '2026-10-05'::date, '2026-10-05'::date, x.direction, x.category_id, x.concept, x.counterparty, x.amount, 'Banco Popular', null, x.note
  from (
    values
      -- Paso 1: dos viajes de Uber (03 y 04-oct), liquidados el 05-oct,
      -- cubiertos por adelanto automatico de la linea de reserva.
      -- PENDIENTE: confirmar con Marieeta la categoria real de "Uber".
      ('egreso', v_uber_pending, 'Uber Trip 03-oct', 'Uber', 5.96, 'PENDIENTE: sin categoria confirmada para Uber (sin precedente en el historial). Cargado temporalmente en Debitos Bancarios a la espera de que Marieeta confirme la categoria correcta.'),
      ('ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 5.96, null::text),
      ('egreso', v_uber_pending, 'Uber Trip 04-oct', 'Uber', 5.95, 'PENDIENTE: sin categoria confirmada para Uber (sin precedente en el historial). Cargado temporalmente en Debitos Bancarios a la espera de que Marieeta confirme la categoria correcta.'),
      ('ingreso', v_utilizacion, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 5.95, null),

      -- Paso 2: Planet Home, segundo intento, devuelto de nuevo (el
      -- primero fue el 01-oct). No se resolvio como los demas casos del
      -- historial; ver informe aparte de pagos devueltos.
      ('egreso', v_debitos, 'EFT PMT PLANET HOME RETRY PYMT XXXXXXXXXXX4609', 'EFT PMT PLANET HOME RETRY PYMT XXXXXXXXXXX4609', 2149.11, null),
      ('ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'EFT PMT PLANET HOME RETRY PYMT XXXXXXXXXXX4609', 2149.11, 'Segundo rebote seguido del pago a Planet Home (primer intento devuelto el 10/01). Ver informe aparte de pagos devueltos.'),

      -- Paso 3: debito atipico de Banktech (sin precedente de debito,
      -- solo depositos), devuelto el mismo dia.
      ('egreso', v_debitos, 'EFT PMT Banktech WEB PMTS XXXXXXXXXXXCC81', 'EFT PMT Banktech WEB PMTS XXXXXXXXXXXCC81', 1371.03, 'Caso atipico: no hay precedente de un debito de Banktech en este historial (siempre fueron depositos). Vale la pena confirmar con Banktech/Clover.'),
      ('ingreso', v_ajustes, 'EFT PAYMENT DEVUELTO SF', 'EFT PMT Banktech WEB PMTS XXXXXXXXXXXCC81', 1371.03, 'Reverso del debito atipico de Banktech del 10/05.')
  ) as x(direction, category_id, concept, counterparty, amount, note)
  where not exists (
    select 1 from tresbe_budget_movements m
    where m.company_id = v_company_id
      and m.entry_date = '2026-10-05'
      and m.category_id = x.category_id
      and m.direction = x.direction
      and m.amount = x.amount
      and m.account = 'Banco Popular'
      and m.concept = x.concept
      and m.counterparty = x.counterparty
  );
end $$;
