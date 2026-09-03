-- Corrige la semilla de la semana del 24-30 ago 2026 para que coincida con
-- TRESBE_Seguimiento_Diario_v4.xlsm (la migración 20260901010000 seguía a la
-- v3). Cinco cambios, todos verificados contra la planilla v4:
--
--   1. "Cash" $800.00 (25 ago) pasa de Reembolsos mercadería a Proveedores.
--   2. "Samuel Canales Lugo" $71.80 (27 ago) pasa de Proveedores a
--      Reembolsos mercadería.
--   3. "True Waste" $94.78 (27 ago, Trampa Grasa) pasa de Proveedores a
--      Recurrentes.
--   4. El $4,000.00 "Intercompany" (28 ago) estaba duplicado como Reembolsos
--      mercadería sin contraparte; se borra y se reemplaza por un solo
--      movimiento en Intercompany Entregado con contraparte GRUPO SIBARITA
--      LLC (confirmada por Maria).
--   5. El $2,248.94 (24 ago, Fondo Transf. Reserva) pasa de Utilización a
--      Repago de Línea de Crédito.
--
-- Además carga las ventas en efectivo de la semana (cuenta "Cash / Caja",
-- ausentes en la semilla original) y ajusta el saldo bancario inicial a $0
-- (deuda de la reserva, confirmado por Maria).

DO $$
DECLARE
  v_company UUID;
  v_reembolsos UUID;
  v_proveedores UUID;
  v_recurrentes UUID;
  v_cash_disponible UUID;
  v_intercompany_entregado UUID;
  v_linea_repago UUID;
  v_sibarita UUID;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug = 'tresbe';
  IF v_company IS NULL THEN RETURN; END IF;

  -- Ya aplicado (por esta migración o a mano contra producción).
  IF EXISTS (
    SELECT 1 FROM public.tresbe_budget_movements
     WHERE company_id = v_company AND week_start = DATE '2026-08-24'
       AND account = 'Cash / Caja'
  ) THEN RETURN; END IF;

  SELECT id INTO v_reembolsos FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'reembolsos_mercaderia';
  SELECT id INTO v_proveedores FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'proveedores';
  SELECT id INTO v_recurrentes FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'recurrentes';
  SELECT id INTO v_cash_disponible FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'cash_disponible';
  SELECT id INTO v_intercompany_entregado FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'intercompany_entregado';
  SELECT id INTO v_linea_repago FROM public.tresbe_budget_categories
   WHERE company_id = v_company AND code = 'linea_credito_repago';
  SELECT id INTO v_sibarita FROM public.tresbe_budget_counterparties
   WHERE company_id = v_company AND name = 'GRUPO SIBARITA LLC';

  -- 1. Cash $800 -> Proveedores
  UPDATE public.tresbe_budget_movements
     SET category_id = v_proveedores
   WHERE company_id = v_company AND category_id = v_reembolsos
     AND entry_date = DATE '2026-08-25' AND amount = 800.00;

  -- 2. Samuel Canales Lugo $71.80 -> Reembolsos mercadería
  UPDATE public.tresbe_budget_movements
     SET category_id = v_reembolsos
   WHERE company_id = v_company AND category_id = v_proveedores
     AND entry_date = DATE '2026-08-27' AND amount = 71.80;

  -- 3. True Waste $94.78 -> Recurrentes
  UPDATE public.tresbe_budget_movements
     SET category_id = v_recurrentes
   WHERE company_id = v_company AND category_id = v_proveedores
     AND entry_date = DATE '2026-08-27' AND amount = 94.78
     AND counterparty ILIKE '%True Waste%';

  -- 4. $4,000 Intercompany: borra el duplicado sin contraparte, inserta el
  --    correcto en Intercompany Entregado.
  DELETE FROM public.tresbe_budget_movements
   WHERE company_id = v_company AND category_id = v_reembolsos
     AND entry_date = DATE '2026-08-28' AND amount = 4000.00
     AND concept = 'Intercompany';

  INSERT INTO public.tresbe_budget_movements (
    company_id, entry_date, week_start, direction, category_id,
    concept, counterparty, counterparty_id, amount, account, note
  )
  SELECT v_company, DATE '2026-08-28', DATE '2026-08-24', 'egreso',
         v_intercompany_entregado, 'Intercompany', 'GRUPO SIBARITA LLC',
         v_sibarita, 4000.00, 'Banco Popular',
         'Contraparte confirmada por Maria (2026-09-02)'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tresbe_budget_movements
     WHERE company_id = v_company AND category_id = v_intercompany_entregado
       AND entry_date = DATE '2026-08-28' AND amount = 4000.00
  );

  -- 5. $2,248.94 (24 ago) Utilización -> Repago de Línea de Crédito
  UPDATE public.tresbe_budget_movements
     SET category_id = v_linea_repago, direction = 'egreso'
   WHERE company_id = v_company
     AND entry_date = DATE '2026-08-24' AND amount = 2248.94
     AND counterparty = 'Transferencia Reserva';

  -- Ventas en efectivo de la semana (Movimientos Reales, cuenta Cash / Caja).
  INSERT INTO public.tresbe_budget_movements (
    company_id, entry_date, week_start, direction, category_id,
    concept, counterparty, amount, account, note
  )
  SELECT v_company, d.entry_date, DATE '2026-08-24', 'ingreso',
         v_cash_disponible, 'Ventas', 'VENTAS CASH', d.amount, 'Cash / Caja',
         'Cargado desde TRESBE_Seguimiento_Diario_v4.xlsm (Movimientos Reales)'
    FROM (VALUES
      (DATE '2026-08-24', 234.37),
      (DATE '2026-08-25', 114.65),
      (DATE '2026-08-26', 146.51),
      (DATE '2026-08-27', 173.53),
      (DATE '2026-08-28', 6.09),
      (DATE '2026-08-29', 91.14),
      (DATE '2026-08-30', 193.95)
    ) AS d(entry_date, amount);

  UPDATE public.tresbe_budget_cash_control
     SET opening_bank_balance = 0.00,
         notes = 'Saldo inicial en $0 por la deuda de la reserva (confirmado por Maria, 2026-09-02). Falta completar saldo real y caja mínima objetivo.'
   WHERE company_id = v_company AND week_start = DATE '2026-08-24';
END $$;
