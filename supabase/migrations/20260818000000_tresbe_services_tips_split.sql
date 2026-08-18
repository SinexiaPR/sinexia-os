-- Tips paid entirely through a "servicios completos" employee's single
-- check (never split into a separate tip check, per
-- getServiceCheckPayAmount) were being summed into total_tips AND folded
-- into that employee's check amount, double-counting them across the
-- Tresbe payroll header's Tips/Servicios/Ajustes breakdown. Recomputes
-- both totals so they partition the grand total with no overlap.

CREATE OR REPLACE FUNCTION public.recalculate_tresbe_payroll(p_payroll_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payroll public.tresbe_payrolls%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can recalculate Tresbe payroll';
  END IF;
  SELECT * INTO v_payroll FROM public.tresbe_payrolls
   WHERE id = p_payroll_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_tresbe_company(v_payroll.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll not found';
  END IF;
  IF v_payroll.status NOT IN ('draft', 'calculated', 'corrected') THEN
    RAISE EXCEPTION 'Only open Tresbe payrolls can be recalculated';
  END IF;

  UPDATE public.tresbe_payrolls payroll
     SET employee_count = totals.employee_count,
         total_weekly_hours = totals.total_weekly_hours,
         total_system_hours = totals.total_system_hours,
         total_service_hours = totals.total_service_hours,
         total_system_pay = totals.total_system_pay,
         total_tips = totals.total_tips,
         total_service_checks = totals.total_service_checks,
         total_adjustments = totals.total_adjustments,
         grand_total = totals.grand_total,
         status = CASE WHEN payroll.status = 'corrected' THEN 'corrected'::public.tresbe_payroll_status ELSE 'calculated'::public.tresbe_payroll_status END,
         updated_by = auth.uid()
    FROM (
      SELECT
        count(*)::INTEGER AS employee_count,
        round(COALESCE(sum(total_weekly_hours), 0), 2) AS total_weekly_hours,
        round(COALESCE(sum(system_hours), 0), 2) AS total_system_hours,
        round(COALESCE(sum(service_hours), 0), 2) AS total_service_hours,
        round(COALESCE(sum(system_pay), 0), 2) AS total_system_pay,
        round(COALESCE(sum(
          CASE WHEN payroll_rule_snapshot = 'full_services' THEN 0 ELSE tips END
        ), 0), 2) AS total_tips,
        round(COALESCE(sum(
          CASE
            WHEN payroll_rule_snapshot = 'full_services' THEN tips + service_check_amount
            WHEN service_check_amount > 0 THEN service_check_amount
            ELSE 0
          END
        ), 0), 2) AS total_service_checks,
        round(COALESCE(sum(other_adjustments), 0), 2) AS total_adjustments,
        round(COALESCE(sum(employee_total), 0), 2) AS grand_total
      FROM public.tresbe_payroll_entries WHERE payroll_id = p_payroll_id
    ) totals
   WHERE payroll.id = p_payroll_id;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  VALUES (p_payroll_id, auth.uid(), 'recalculated');
END;
$$;
