-- Corrige weekly_control de cutmeat_daily_controls(): para un día
-- CERRADO, las cubetas "recurrentes prior"/"recurrentes semana" ahora
-- se leen de la foto congelada (cutmeat_daily_recurring_snapshot,
-- Opción B) en vez de cutmeat_recurrentes en vivo -- igual que
-- getDailyReportWorkspace en la app. cutmeat_recurrentes.pagado/
-- paid_date son campos GLOBALES: corregir un recurrente hoy (p.ej.
-- marcarlo pagado con una fecha real posterior al cierre de un día ya
-- cerrado) no debe cambiar retroactivamente el control de ese día. Para
-- un día no cerrado, balance_after_weekly es NULL y weekly_control ya
-- sale NULL de todas formas (ver el CASE más abajo), así que la rama
-- "en vivo" solo importa como resguardo si un día cerrado no tuviera
-- foto por algún motivo. Solo cambia la función -- no toca datos ni
-- cierra/reabre ningún día.
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
  v_snapshot_rows INTEGER;
BEGIN
  v_week_start := p_report_date - EXTRACT(DOW FROM p_report_date)::int;

  SELECT id, status, balance_after_weekly, balance_gabriel
    INTO v_report_id, v_status, v_balance_after_weekly, v_balance_gabriel
  FROM public.cutmeat_daily_reports
  WHERE company_id = p_company_id AND report_date = p_report_date;

  SELECT r.statement_ending, r.register INTO v_statement_ending, v_register
  FROM public.cutmeat_daily_reconciliation r
  WHERE r.report_id = v_report_id;

  SELECT COALESCE(sum(i.amount), 0) INTO v_items_total
  FROM public.cutmeat_daily_reconciliation_items i
  WHERE i.report_id = v_report_id
    AND i.item_type IN ('uncleared_check', 'uncleared_deposit');

  v_statement_control := CASE
    WHEN v_statement_ending IS NULL THEN NULL
    ELSE round(v_statement_ending + v_items_total - v_register, 2)
  END;

  SELECT count(*) INTO v_snapshot_rows
  FROM public.cutmeat_daily_recurring_snapshot s
  WHERE s.report_id = v_report_id;

  IF v_status = 'closed' AND v_snapshot_rows > 0 THEN
    SELECT COALESCE(sum(s.amount), 0) INTO v_recurrentes_prior
    FROM public.cutmeat_daily_recurring_snapshot s
    WHERE s.report_id = v_report_id AND s.is_paid = false AND s.due_date IS NOT NULL AND s.due_date < v_week_start;

    SELECT COALESCE(sum(s.amount), 0) INTO v_recurrentes_week
    FROM public.cutmeat_daily_recurring_snapshot s
    WHERE s.report_id = v_report_id AND s.is_paid = false AND s.due_date IS NOT NULL
      AND s.due_date >= v_week_start AND s.due_date <= v_week_start + 6;
  ELSE
    SELECT COALESCE(sum(amount), 0) INTO v_recurrentes_prior
    FROM public.cutmeat_recurrentes
    WHERE company_id = p_company_id AND pagado = false AND due_date IS NOT NULL AND due_date < v_week_start;

    SELECT COALESCE(sum(amount), 0) INTO v_recurrentes_week
    FROM public.cutmeat_recurrentes
    WHERE company_id = p_company_id AND pagado = false AND due_date IS NOT NULL
      AND due_date >= v_week_start AND due_date <= v_week_start + 6;
  END IF;

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
