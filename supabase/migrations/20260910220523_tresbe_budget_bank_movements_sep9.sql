-- TRESBE budget: load real bank movements for 2026-09-09, transcribed from
-- the Modelo Maestro's "Movimientos Reales" tab (rows 142-163).
--
-- Loads the FULL set of 18 Nómina lines, not just the first 9 -- Maria's own
-- "Seguimiento Diario" Real columns are wrong for this and every later day,
-- because every one of its SUMIFS formulas is hardcoded to the range
-- $4:$153, and Movimientos Reales has grown past row 153. The 9 Nómina
-- rows beyond it ($2,129.55) are silently dropped from her sheet's totals;
-- Sinexia OS loads the complete, correct set from the raw ledger instead.
--
-- The two "Intercompany Recibido" rows ($7,000 + $5,000, Cash Sibarita)
-- are recorded with Tipo='Financiamiento' in her sheet rather than
-- 'Intercompany' -- inconsistent with her own convention, and likely why
-- she flagged them "REVISAR": with that Tipo they fall through every one
-- of her SUMIFS filters (neither the Intercompany nor the Financiamiento
-- ones match) and aren't counted anywhere in her Real totals either.
-- Categorized here per Sinexia OS's own schema (Intercompany Recibido,
-- GRUPO SIBARITA LLC) with a note flagging her "REVISAR". Idempotent.
do $$
declare
  v_company_id uuid := '039a6f05-0dc7-43ac-9799-70011a3dbcd1';
  v_credit_card uuid := 'c3abb98b-b913-4572-a929-112750306178';
  v_nomina uuid := 'cd7fa5d5-bd34-42a9-890e-d31c1b6ee1c0';
  v_repago uuid := '755c9b92-25c6-437c-99fc-8740a3ef3156';
  v_intercompany_recibido uuid;
  v_sibarita uuid := '8245c3b8-651d-4591-94fd-a1e2460a246b';
begin
  select id into v_intercompany_recibido from tresbe_budget_categories
    where company_id = v_company_id and code = 'intercompany_recibido';

  if exists (
    select 1 from tresbe_budget_movements
    where company_id = v_company_id and entry_date = '2026-09-09'
  ) then
    return;
  end if;

  insert into tresbe_budget_movements
    (company_id, entry_date, week_start, direction, category_id, concept, counterparty, amount, account, counterparty_id, note)
  values
    (v_company_id, '2026-09-09', '2026-09-07', 'ingreso', v_intercompany_recibido, 'Intercompany', 'Cash Sibarita', 7000.00, 'Banco Popular', v_sibarita, 'REVISAR (nota de Maria en el Modelo Maestro)'),
    (v_company_id, '2026-09-09', '2026-09-07', 'ingreso', v_intercompany_recibido, 'Intercompany', 'Cash Sibarita', 5000.00, 'Banco Popular', v_sibarita, 'REVISAR (nota de Maria en el Modelo Maestro)'),
    (v_company_id, '2026-09-09', '2026-09-07', 'ingreso', v_credit_card, 'Ventas', 'Deposito Clover', 833.43, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Doel Acosta - 15050', 96.54, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Fernando Almonte - 15051', 600.27, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Lee Piere -15057', 428.37, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jared Rivera - 15062', 336.84, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Yohamid Rodriguez - 15064', 509.72, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Shaddai Sanchez - 15066', 404.96, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Doel Acosta - 15068', 339.53, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Lee Pierre - 15075', 270.24, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jared Rivera - 15081', 876.64, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Yohamid Rodriguez - 15083', 303.92, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Shaddai Sanchez - 15085', 312.31, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Fernando Almonte - 20693', 280.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Jared Rivera - 20704', 105.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Lee de Jesus - 15037', 116.84, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Candelara Velez - 15052', 369.65, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Natalie Rivera - 15063', 353.92, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Candelar Velez - 15070', 224.91, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_nomina, 'Nomina', 'Christopher Padilla - 20691', 63.00, 'Banco Popular', null, null),
    (v_company_id, '2026-09-09', '2026-09-07', 'egreso', v_repago, 'Fondo Transf. Reserva', 'Fondo Transf. Reserva', 6840.77, 'Banco Popular', null, null);
end $$;
