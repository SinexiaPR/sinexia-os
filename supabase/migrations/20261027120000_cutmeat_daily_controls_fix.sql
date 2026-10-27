-- Corrige dos defectos conocidos de cutmeat_daily_controls()
-- (20261013131000_cutmeat_daily_calc_fixes.sql), que lo hacían marcar
-- ok:false aun cuando los controles reales (la lógica de la app en
-- lib/cutmeat-daily/calculations.ts) ya daban 0.00. Solo cambia la
-- función -- no toca ningún dato, no cierra ni reabre ningún día.
--
-- 1. statement_control sumaba TODOS los renglones de
--    cutmeat_daily_reconciliation_items, incluidos los "cleared_check"/
--    "cleared_deposit" -- que ya están dentro del extracto bancario
--    (statement_ending) y no deben volver a sumarse. Ahora solo suma
--    "uncleared_check"/"uncleared_deposit" (as of + after), igual que
--    checkReconciliationControl en la app.
-- 2. not_entered_pending contaba cualquier movimiento del banco sin
--    recurrente vinculado y sin marcar "Not entered Sales" -- sin
--    importar si ya estaba conciliado (is_reconciled_cleared=true, p.ej.
--    un Export ya cuadrado contra el Reconciliation Report). Ahora
--    excluye esos movimientos, igual que classifyBankMovements en la
--    app (is_reconciled_cleared=true -> "classified", nunca "sin
--    clasificar").
CREATE OR REPLACE FUNCTION public.cutmeat_daily_controls(p_company_id UUID, p_report_date DATE)
RETURNS TABLE (
  report_id UUID,
  statement_control NUMERIC,
  statement_balanced BOOLEAN,
  weekly_control NUMERIC,
  weekly_balanced BOOLEAN,
  gabriel_control NUMERIC,
  gabriel_balanced BOOLEAN,
  not_entered_pending_count INTEGER,
  not_entered_balanced BOOLEAN,
  ok BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_report_id UUID;
  v_status TEXT;
  v_week_start DATE;
  v_statement_ending NUMERIC;
  v_register NUMERIC;
  v_items_total NUMERIC;
  v_statement_control NUMERIC;
  v_balance_after_weekly NUMERIC;
  v_balance_gabriel NUMERIC;
  v_recurrentes_prior NUMERIC;
  v_recurrentes_week NUMERIC;
  v_weekly_control NUMERIC;
  v_previous_balance NUMERIC;
  v_gabriel_control NUMERIC;
  v_not_entered_pending INTEGER;
BEGIN
  v_week_start := p_report_date - EXTRACT(DOW FROM p_report_date)::int;

  SELECT id, status, balance_after_weekly, balance_gabriel
    INTO v_report_id, v_status, v_balance_after_weekly, v_balance_gabriel
  FROM public.cutmeat_daily_reports
  WHERE company_id = p_company_id AND report_date = p_report_date;

  SELECT r.statement_ending, r.register INTO v_statement_ending, v_register
  FROM public.cutmeat_daily_reconciliation r
  WHERE r.report_id = v_report_id;

  -- Fix 1: solo las líneas "uncleared" (as of + after) -- las
  -- "cleared_check"/"cleared_deposit" ya están dentro de statement_ending.
  SELECT COALESCE(sum(i.amount), 0) INTO v_items_total
  FROM public.cutmeat_daily_reconciliation_items i
  WHERE i.report_id = v_report_id
    AND i.item_type IN ('uncleared_check', 'uncleared_deposit');

  v_statement_control := CASE
    WHEN v_statement_ending IS NULL THEN NULL
    ELSE round(v_statement_ending + v_items_total - v_register, 2)
  END;

  SELECT COALESCE(sum(amount), 0) INTO v_recurrentes_prior
  FROM public.cutmeat_recurrentes
  WHERE company_id = p_company_id AND pagado = false AND due_date IS NOT NULL AND due_date < v_week_start;

  SELECT COALESCE(sum(amount), 0) INTO v_recurrentes_week
  FROM public.cutmeat_recurrentes
  WHERE company_id = p_company_id AND pagado = false AND due_date IS NOT NULL
    AND due_date >= v_week_start AND due_date <= v_week_start + 6;

  v_weekly_control := CASE
    WHEN v_register IS NULL OR v_balance_after_weekly IS NULL THEN NULL
    ELSE round(v_register - v_recurrentes_prior - v_recurrentes_week - v_balance_after_weekly, 2)
  END;

  SELECT balance FROM (
    SELECT balance_after_weekly AS balance, report_date FROM public.cutmeat_daily_history
    WHERE company_id = p_company_id AND report_date < p_report_date
    UNION ALL
    SELECT balance_after_weekly AS balance, report_date FROM public.cutmeat_daily_reports
    WHERE company_id = p_company_id AND report_date < p_report_date
      AND status = 'closed' AND balance_after_weekly IS NOT NULL
  ) AS prior
  ORDER BY report_date DESC
  LIMIT 1
  INTO v_previous_balance;

  v_gabriel_control := CASE
    WHEN v_balance_gabriel IS NULL THEN NULL
    ELSE round(v_balance_gabriel - COALESCE(v_previous_balance, v_balance_gabriel), 2)
  END;

  -- Fix 2: excluye los movimientos ya conciliados (is_reconciled_cleared)
  -- -- no están "sin clasificar", igual que classifyBankMovements.
  SELECT count(*) INTO v_not_entered_pending
  FROM public.cutmeat_daily_bank_movements m
  WHERE m.report_id = v_report_id
    AND m.linked_recurring_id IS NULL
    AND m.is_not_entered_deposit = false
    AND m.is_reconciled_cleared = false;

  RETURN QUERY SELECT
    v_report_id,
    v_statement_control,
    v_statement_control IS NOT NULL AND abs(v_statement_control) < 0.01,
    v_weekly_control,
    v_weekly_control IS NOT NULL AND abs(v_weekly_control) < 0.01,
    v_gabriel_control,
    v_gabriel_control IS NOT NULL AND abs(v_gabriel_control) < 0.01,
    v_not_entered_pending,
    v_not_entered_pending = 0,
    COALESCE(v_statement_control IS NOT NULL AND abs(v_statement_control) < 0.01, false)
      AND COALESCE(v_weekly_control IS NOT NULL AND abs(v_weekly_control) < 0.01, false)
      AND COALESCE(v_gabriel_control IS NOT NULL AND abs(v_gabriel_control) < 0.01, false)
      AND v_not_entered_pending = 0;
END;
$$;
