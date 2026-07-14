-- Confirmed Tresbe aliases and wage corrections received 2026-07-13.
-- Only existing alias targets are updated. Closed payroll snapshots remain unchanged.

SELECT set_config(
  'app.tresbe_wage_source',
  'Confirmed Tresbe aliases and wages — 2026-07-13',
  true
);

DROP TABLE IF EXISTS pg_temp.tresbe_confirmed_alias_wages_20260713;
CREATE TEMP TABLE tresbe_confirmed_alias_wages_20260713 (
  target_name TEXT PRIMARY KEY,
  official_name TEXT NOT NULL,
  hourly_wage NUMERIC(12,2) NOT NULL
) ON COMMIT DROP;

INSERT INTO tresbe_confirmed_alias_wages_20260713 VALUES
  ('jared rivera', 'Jared Rivera Rodriguez', 10.50),
  ('lee pierre', 'Lee Zephyrus P. Irene', 13.00),
  ('lee sanchez', 'Lee J. de Jesus Sanchez', 11.00),
  ('henry casiano', 'Casiano Henry', 15.00);

-- Alias matches never insert employees. The existing display name remains authoritative.
UPDATE public.tresbe_employees employee
SET source_name = alias.official_name,
    regular_hourly_rate = alias.hourly_wage,
    annual_salary = NULL,
    default_weekly_salary = NULL,
    payroll_rule = 'standard_hourly_40_plus_services',
    payment_method = 'mixed',
    wage_requires_review = false,
    wage_review_reason = NULL,
    wage_source = 'Confirmed Tresbe aliases and wages — 2026-07-13',
    wage_updated_at = now()
FROM tresbe_confirmed_alias_wages_20260713 alias
WHERE public.is_tresbe_company(employee.company_id)
  AND employee.normalized_name = alias.target_name;

-- Julian and Nashely remain full-service employees; only their confirmed wage changes.
UPDATE public.tresbe_employees employee
SET regular_hourly_rate = confirmed.hourly_wage,
    service_hourly_rate = confirmed.hourly_wage,
    annual_salary = NULL,
    default_weekly_salary = NULL,
    wage_requires_review = false,
    wage_review_reason = NULL,
    wage_source = 'Confirmed Tresbe aliases and wages — 2026-07-13',
    wage_updated_at = now()
FROM (VALUES
  ('julian mateo'::TEXT, 10.00::NUMERIC),
  ('nashely'::TEXT, 4.50::NUMERIC)
) AS confirmed(target_name, hourly_wage)
WHERE public.is_tresbe_company(employee.company_id)
  AND employee.normalized_name = confirmed.target_name
  AND employee.payroll_rule = 'full_services';

-- Fernando is a fixed weekly salary employee, not hourly.
UPDATE public.tresbe_employees employee
SET regular_hourly_rate = NULL,
    service_hourly_rate = NULL,
    annual_salary = NULL,
    default_weekly_salary = 400.00,
    payroll_rule = 'fixed_weekly_salary',
    payment_method = 'payroll_system',
    wage_requires_review = false,
    wage_review_reason = NULL,
    wage_source = 'Confirmed Tresbe aliases and wages — 2026-07-13',
    wage_updated_at = now()
WHERE public.is_tresbe_company(employee.company_id)
  AND employee.normalized_name = 'fernando almonte';

-- Permanent full-service employees are never included in payroll-system pay.
UPDATE public.tresbe_employees employee
SET payroll_rule = 'full_services',
    payment_method = 'services',
    service_hourly_rate = COALESCE(
      employee.service_hourly_rate,
      employee.regular_hourly_rate
    ),
    wage_requires_review = CASE
      WHEN COALESCE(employee.service_hourly_rate, employee.regular_hourly_rate, 0) > 0
        THEN false
      ELSE employee.wage_requires_review
    END,
    wage_review_reason = CASE
      WHEN COALESCE(employee.service_hourly_rate, employee.regular_hourly_rate, 0) > 0
        THEN NULL
      ELSE employee.wage_review_reason
    END,
    wage_source = 'Confirmed Tresbe full-service configuration — 2026-07-13',
    wage_updated_at = now()
WHERE public.is_tresbe_company(employee.company_id)
  AND employee.normalized_name IN (
    'leslie a. ruiz santiago', 'nashely', 'julian mateo',
    'yediel', 'carlos ramos'
  );

-- Confirmed correction: Ramon Luis Rivera is Seguridad and receives a fixed
-- $220 weekly manual service check.
UPDATE public.tresbe_employees employee
SET area = 'Security',
    regular_hourly_rate = NULL,
    service_hourly_rate = NULL,
    annual_salary = NULL,
    default_weekly_salary = 220.00,
    payroll_rule = 'full_services',
    payment_method = 'services',
    wage_requires_review = false,
    wage_review_reason = NULL,
    wage_source = 'Confirmed Tresbe aliases and wages — 2026-07-13',
    wage_updated_at = now()
WHERE public.is_tresbe_company(employee.company_id)
  AND employee.normalized_name = 'ramon luis rivera';

-- Resolve review rows only for employees that were actually found and updated.
UPDATE public.tresbe_wage_review_items review
SET resolved_at = COALESCE(review.resolved_at, now()),
    resolved_by = NULL
FROM public.tresbe_employees employee
WHERE review.company_id = employee.company_id
  AND review.report_date = DATE '2026-07-13'
  AND review.employee_id = employee.id
  AND employee.normalized_name IN (
    'jared rivera', 'lee pierre', 'lee sanchez',
    'henry casiano', 'julian mateo', 'fernando almonte',
    'nashely', 'ramon luis rivera'
  )
  AND employee.wage_requires_review = false;

UPDATE public.tresbe_wage_review_items review
SET resolved_at = COALESCE(review.resolved_at, now()),
    resolved_by = NULL
FROM public.tresbe_employees employee
JOIN tresbe_confirmed_alias_wages_20260713 alias
  ON alias.target_name = employee.normalized_name
WHERE review.company_id = employee.company_id
  AND review.report_date = DATE '2026-07-13'
  AND review.review_key = 'official:' || lower(alias.official_name)
  AND employee.wage_requires_review = false;

-- Safety assertions for existing confirmed employees. These do not create records.
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE slug = 'tresbe' LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Tresbe company not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'lee pierre'
      AND source_name = 'Lee Zephyrus P. Irene'
      AND regular_hourly_rate = 13.00
  ) THEN RAISE EXCEPTION 'Lee Pierre alias/wage update failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'henry casiano'
      AND source_name = 'Casiano Henry' AND regular_hourly_rate = 15.00
      AND payroll_rule = 'standard_hourly_40_plus_services'
  ) THEN RAISE EXCEPTION 'Henry Casiano alias/wage update failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'julian mateo'
      AND payroll_rule = 'full_services' AND regular_hourly_rate = 10.00
  ) THEN RAISE EXCEPTION 'Julian Mateo wage update failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'nashely'
      AND payroll_rule = 'full_services' AND regular_hourly_rate = 4.50
  ) THEN RAISE EXCEPTION 'Nashely wage update failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'fernando almonte'
      AND payroll_rule = 'fixed_weekly_salary' AND regular_hourly_rate IS NULL
      AND default_weekly_salary = 400.00
  ) THEN RAISE EXCEPTION 'Fernando Almonte salary update failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'ramon luis rivera'
      AND area = 'Security' AND payroll_rule = 'full_services'
      AND regular_hourly_rate IS NULL AND default_weekly_salary = 220.00
  ) THEN RAISE EXCEPTION 'Ramon Luis Rivera salary update failed'; END IF;
END;
$$;

-- Full-service entries support either hourly service wages or a fixed weekly
-- service amount. This keeps system_pay at zero in both cases.
CREATE OR REPLACE FUNCTION public.calculate_tresbe_payroll_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_service_rate NUMERIC(12,2);
BEGIN
  v_service_rate := COALESCE(NEW.service_rate_snapshot, NEW.regular_rate_snapshot, 0);
  NEW.system_hours := 0;
  NEW.service_hours := 0;
  NEW.system_pay := 0;
  NEW.service_check_amount := 0;
  NEW.service_reason := NULLIF(trim(COALESCE(NEW.service_reason, '')), '');

  CASE NEW.payroll_rule_snapshot
    WHEN 'unconfigured' THEN NULL;
    WHEN 'standard_hourly_40_plus_services' THEN
      NEW.system_hours := LEAST(NEW.total_weekly_hours, 40);
      NEW.service_hours := GREATEST(NEW.total_weekly_hours - 40, 0);
      NEW.system_pay := round(NEW.system_hours * COALESCE(NEW.regular_rate_snapshot, 0), 2);
      NEW.service_check_amount := CASE
        WHEN NEW.service_hours > 0 AND NEW.fixed_service_amount > 0
          THEN round(NEW.fixed_service_amount, 2)
        ELSE round(NEW.service_hours * v_service_rate, 2)
      END;
      IF NEW.service_hours > 0 THEN NEW.service_reason := 'Horas sobre 40'; END IF;
    WHEN 'full_services' THEN
      NEW.service_hours := NEW.total_weekly_hours;
      NEW.service_check_amount := CASE
        WHEN NEW.fixed_service_amount > 0 THEN round(NEW.fixed_service_amount, 2)
        WHEN COALESCE(NEW.weekly_salary_snapshot, 0) > 0
          THEN round(NEW.weekly_salary_snapshot, 2)
        ELSE round(NEW.service_hours * COALESCE(NEW.service_rate_snapshot, 0), 2)
      END;
      NEW.service_reason := COALESCE(NEW.service_reason, 'Empleado por servicios');
    WHEN 'preset_40_weekly_salary' THEN
      NEW.system_hours := NEW.total_weekly_hours;
      NEW.system_pay := round(COALESCE(NEW.weekly_salary_snapshot, 0), 2);
    WHEN 'fixed_weekly_salary' THEN
      NEW.system_hours := NEW.total_weekly_hours;
      NEW.system_pay := round(COALESCE(NEW.weekly_salary_snapshot, 0), 2);
    WHEN 'custom_manual' THEN
      NEW.system_hours := NEW.total_weekly_hours;
      NEW.system_pay := round(NEW.manual_system_amount, 2);
      NEW.service_check_amount := round(NEW.fixed_service_amount, 2);
      IF NEW.service_check_amount > 0 THEN
        NEW.service_reason := COALESCE(NEW.service_reason, 'Ajuste manual');
      END IF;
  END CASE;

  NEW.employee_total := round(
    NEW.system_pay + NEW.tips + NEW.service_check_amount + NEW.other_adjustments,
    2
  );
  RETURN NEW;
END;
$$;

-- Recalculate only open payroll entries so closed historical snapshots remain unchanged.
UPDATE public.tresbe_payroll_entries entry
SET weekly_salary_snapshot = employee.default_weekly_salary,
    payroll_rule_snapshot = employee.payroll_rule,
    payment_method_snapshot = employee.payment_method,
    service_rate_snapshot = employee.service_hourly_rate
FROM public.tresbe_employees employee
JOIN public.tresbe_payrolls payroll ON payroll.company_id = employee.company_id
WHERE entry.employee_id = employee.id
  AND entry.payroll_id = payroll.id
  AND payroll.status IN ('draft', 'calculated', 'corrected')
  AND employee.normalized_name IN (
    'leslie a. ruiz santiago', 'nashely', 'julian mateo',
    'yediel', 'carlos ramos', 'ramon luis rivera'
  );

CREATE OR REPLACE FUNCTION public.send_tresbe_payroll(
  p_payroll_id UUID,
  p_client_note TEXT DEFAULT NULL,
  p_email_recipient TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payroll public.tresbe_payrolls%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can send Tresbe payroll';
  END IF;
  SELECT * INTO v_payroll FROM public.tresbe_payrolls
   WHERE id = p_payroll_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_tresbe_company(v_payroll.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll not found';
  END IF;
  IF v_payroll.status NOT IN ('draft', 'calculated', 'corrected') THEN
    RAISE EXCEPTION 'Tresbe payroll is not open for sending';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tresbe_payroll_entries e
     WHERE e.payroll_id = p_payroll_id AND (
       (e.payroll_rule_snapshot = 'unconfigured'
         AND (
           e.total_weekly_hours > 0 OR e.manual_system_amount > 0 OR
           e.tips > 0 OR e.fixed_service_amount > 0 OR e.other_adjustments <> 0
         )) OR
       (e.payroll_rule_snapshot = 'standard_hourly_40_plus_services'
         AND e.total_weekly_hours > 0 AND COALESCE(e.regular_rate_snapshot, 0) <= 0) OR
       (e.payroll_rule_snapshot = 'standard_hourly_40_plus_services'
         AND e.fixed_service_amount > 0 AND e.service_hours <= 0) OR
       (e.payroll_rule_snapshot = 'standard_hourly_40_plus_services'
         AND e.fixed_service_amount > 0
         AND char_length(trim(COALESCE(e.comment, ''))) < 5) OR
       (e.payroll_rule_snapshot = 'full_services'
         AND e.fixed_service_amount <= 0
         AND COALESCE(e.weekly_salary_snapshot, 0) <= 0
         AND (e.service_hours <= 0 OR COALESCE(e.service_rate_snapshot, 0) <= 0)) OR
       (e.payroll_rule_snapshot IN ('preset_40_weekly_salary', 'fixed_weekly_salary')
         AND COALESCE(e.weekly_salary_snapshot, 0) <= 0) OR
       (e.payroll_rule_snapshot = 'custom_manual'
         AND (e.manual_system_amount > 0 OR e.fixed_service_amount > 0)
         AND char_length(trim(COALESCE(e.comment, ''))) < 5) OR
       (e.other_adjustments < 0 AND char_length(trim(COALESCE(e.comment, ''))) < 5)
     )
  ) THEN
    RAISE EXCEPTION 'Tresbe payroll contains invalid employee payment data';
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
         client_note = NULLIF(trim(COALESCE(p_client_note, '')), ''),
         email_recipient = NULLIF(trim(COALESCE(p_email_recipient, '')), ''),
         status = 'sent',
         sent_by = auth.uid(),
         sent_at = now(),
         viewed_at = NULL,
         pdf_storage_path = '/api/tresbe-payroll/' || payroll.id::TEXT || '/pdf',
         updated_by = auth.uid()
    FROM (
      SELECT
        count(*)::INTEGER AS employee_count,
        round(COALESCE(sum(total_weekly_hours), 0), 2) AS total_weekly_hours,
        round(COALESCE(sum(system_hours), 0), 2) AS total_system_hours,
        round(COALESCE(sum(service_hours), 0), 2) AS total_service_hours,
        round(COALESCE(sum(system_pay), 0), 2) AS total_system_pay,
        round(COALESCE(sum(tips), 0), 2) AS total_tips,
        round(COALESCE(sum(service_check_amount), 0), 2) AS total_service_checks,
        round(COALESCE(sum(other_adjustments), 0), 2) AS total_adjustments,
        round(COALESCE(sum(employee_total), 0), 2) AS grand_total,
        count(*) FILTER (WHERE employee_total <> 0) AS payment_count
      FROM public.tresbe_payroll_entries WHERE payroll_id = p_payroll_id
    ) totals
   WHERE payroll.id = p_payroll_id
     AND totals.payment_count > 0;

  IF NOT FOUND THEN RAISE EXCEPTION 'Tresbe payroll has no active payment data'; END IF;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  VALUES (p_payroll_id, auth.uid(), 'sent_to_client');
END;
$$;
