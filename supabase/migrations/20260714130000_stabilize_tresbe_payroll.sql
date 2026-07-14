-- Stabilize the existing Tresbe payroll workflow without changing other companies.
-- Requires the preceding Tresbe preset-hourly and reconciliation migrations.

CREATE TABLE IF NOT EXISTS public.tresbe_employee_configuration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'aliases_updated', 'status_updated')),
  previous_configuration JSONB,
  new_configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tresbe_employee_configuration_events_employee_idx
  ON public.tresbe_employee_configuration_events(employee_id, created_at DESC);

ALTER TABLE public.tresbe_employee_configuration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Tresbe employee configuration events"
  ON public.tresbe_employee_configuration_events;
CREATE POLICY "Admins read Tresbe employee configuration events"
  ON public.tresbe_employee_configuration_events FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id));
REVOKE INSERT, UPDATE, DELETE ON public.tresbe_employee_configuration_events
  FROM anon, authenticated;
GRANT SELECT ON public.tresbe_employee_configuration_events TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_tresbe_employee_configuration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(OLD) IS NOT DISTINCT FROM to_jsonb(NEW) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tresbe_employee_configuration_events(
    company_id, employee_id, changed_by, action,
    previous_configuration, new_configuration
  ) VALUES (
    NEW.company_id,
    NEW.id,
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'created'
         WHEN OLD.is_active IS DISTINCT FROM NEW.is_active THEN 'status_updated'
         ELSE 'updated' END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_employee_configuration_audit
  ON public.tresbe_employees;
CREATE TRIGGER tresbe_employee_configuration_audit
  AFTER INSERT OR UPDATE ON public.tresbe_employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_tresbe_employee_configuration();

CREATE OR REPLACE FUNCTION public.replace_tresbe_employee_aliases(
  p_employee_id UUID,
  p_aliases TEXT[]
)
RETURNS TABLE(alias_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee public.tresbe_employees%ROWTYPE;
  v_alias TEXT;
  v_normalized TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update Tresbe employee aliases';
  END IF;

  SELECT * INTO v_employee
  FROM public.tresbe_employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_tresbe_company(v_employee.company_id) THEN
    RAISE EXCEPTION 'Tresbe employee not found';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.requested_tresbe_aliases (
    alias_name TEXT NOT NULL,
    normalized_alias TEXT PRIMARY KEY
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.requested_tresbe_aliases;

  FOREACH v_alias IN ARRAY COALESCE(p_aliases, ARRAY[]::TEXT[]) LOOP
    v_alias := regexp_replace(trim(v_alias), '\s+', ' ', 'g');
    v_normalized := lower(v_alias);
    IF char_length(v_alias) BETWEEN 1 AND 202 THEN
      INSERT INTO pg_temp.requested_tresbe_aliases(alias_name, normalized_alias)
      VALUES (v_alias, v_normalized)
      ON CONFLICT (normalized_alias) DO UPDATE
        SET alias_name = EXCLUDED.alias_name;
    END IF;
  END LOOP;

  DELETE FROM public.tresbe_employee_aliases existing
  WHERE existing.employee_id = p_employee_id
    AND NOT EXISTS (
      SELECT 1 FROM pg_temp.requested_tresbe_aliases requested
      WHERE requested.normalized_alias = existing.normalized_alias
    );

  INSERT INTO public.tresbe_employee_aliases(
    company_id, employee_id, alias_name, normalized_alias, source
  )
  SELECT v_employee.company_id, p_employee_id,
         requested.alias_name, requested.normalized_alias,
         'Manual administrator update'
  FROM pg_temp.requested_tresbe_aliases requested
  ON CONFLICT (company_id, normalized_alias) DO UPDATE
    SET employee_id = EXCLUDED.employee_id,
        alias_name = EXCLUDED.alias_name,
        source = EXCLUDED.source;

  INSERT INTO public.tresbe_employee_configuration_events(
    company_id, employee_id, changed_by, action, new_configuration
  ) VALUES (
    v_employee.company_id,
    p_employee_id,
    auth.uid(),
    'aliases_updated',
    jsonb_build_object(
      'aliases', COALESCE((
        SELECT jsonb_agg(alias.alias_name ORDER BY alias.alias_name)
        FROM public.tresbe_employee_aliases alias
        WHERE alias.employee_id = p_employee_id
      ), '[]'::JSONB)
    )
  );

  PERFORM public.refresh_tresbe_employee_reviews(v_employee.company_id);

  RETURN QUERY
  SELECT alias.alias_name
  FROM public.tresbe_employee_aliases alias
  WHERE alias.employee_id = p_employee_id
  ORDER BY alias.alias_name;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_tresbe_employee_aliases(UUID, TEXT[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_tresbe_employee_aliases(UUID, TEXT[])
  TO authenticated;

-- Every new payroll is a snapshot of the persistent ACTIVE master directory.
CREATE OR REPLACE FUNCTION public.load_tresbe_payroll_employees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tresbe_payroll_entries (
    payroll_id, employee_id, employee_name_snapshot, area_snapshot,
    payment_method_snapshot, payroll_rule_snapshot,
    receives_proportional_tips_snapshot, regular_rate_snapshot,
    service_rate_snapshot, weekly_salary_snapshot, total_weekly_hours
  )
  SELECT
    NEW.id, employee.id, employee.display_name, employee.area,
    employee.payment_method, employee.payroll_rule,
    employee.receives_proportional_tips, employee.regular_hourly_rate,
    employee.service_hourly_rate, employee.default_weekly_salary,
    COALESCE(employee.default_weekly_hours, 0)
  FROM public.tresbe_employees employee
  WHERE employee.company_id = NEW.company_id
    AND employee.is_active
  ON CONFLICT (payroll_id, employee_id) DO NOTHING;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  VALUES (NEW.id, NEW.created_by, 'draft_created');
  RETURN NEW;
END;
$$;

-- Refresh open snapshots while preserving weekly hours, tips, adjustments and comments.
CREATE OR REPLACE FUNCTION public.sync_tresbe_employee_to_open_payrolls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO public.tresbe_payroll_entries (
      payroll_id, employee_id, employee_name_snapshot, area_snapshot,
      payment_method_snapshot, payroll_rule_snapshot,
      receives_proportional_tips_snapshot, regular_rate_snapshot,
      service_rate_snapshot, weekly_salary_snapshot, total_weekly_hours,
      is_new_employee
    )
    SELECT
      payroll.id, NEW.id, NEW.display_name, NEW.area,
      NEW.payment_method, NEW.payroll_rule, NEW.receives_proportional_tips,
      NEW.regular_hourly_rate, NEW.service_hourly_rate,
      NEW.default_weekly_salary, COALESCE(NEW.default_weekly_hours, 0), true
    FROM public.tresbe_payrolls payroll
    WHERE payroll.company_id = NEW.company_id
      AND payroll.status IN ('draft', 'calculated', 'corrected')
    ON CONFLICT (payroll_id, employee_id) DO NOTHING;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.tresbe_payroll_entries entry
    SET employee_name_snapshot = NEW.display_name,
        area_snapshot = NEW.area,
        payment_method_snapshot = NEW.payment_method,
        payroll_rule_snapshot = NEW.payroll_rule,
        receives_proportional_tips_snapshot = NEW.receives_proportional_tips,
        regular_rate_snapshot = NEW.regular_hourly_rate,
        service_rate_snapshot = NEW.service_hourly_rate,
        weekly_salary_snapshot = NEW.default_weekly_salary,
        total_weekly_hours = CASE
          WHEN entry.total_weekly_hours = COALESCE(OLD.default_weekly_hours, 0)
           AND entry.tips = 0
           AND entry.fixed_service_amount = 0
           AND entry.other_adjustments = 0
           AND entry.manual_system_amount = 0
           AND entry.comment IS NULL
          THEN COALESCE(NEW.default_weekly_hours, 0)
          ELSE entry.total_weekly_hours
        END
    FROM public.tresbe_payrolls payroll
    WHERE entry.payroll_id = payroll.id
      AND entry.employee_id = NEW.id
      AND payroll.status IN ('draft', 'calculated', 'corrected');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_tresbe_employee_reviews(
  p_company_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_tresbe_company(p_company_id) THEN
    RAISE EXCEPTION 'Tresbe company not found';
  END IF;

  UPDATE public.tresbe_wage_review_items
  SET resolved_at = COALESCE(resolved_at, now()),
      resolved_by = COALESCE(resolved_by, auth.uid())
  WHERE company_id = p_company_id
    AND resolved_at IS NULL;

  UPDATE public.tresbe_employees employee
  SET wage_requires_review = CASE
        WHEN employee.payroll_rule = 'unconfigured' THEN true
        WHEN employee.payroll_rule IN (
          'standard_hourly_40_plus_services', 'preset_40_hourly'
        ) THEN COALESCE(employee.regular_hourly_rate, 0) <= 0
        WHEN employee.payroll_rule = 'full_services' THEN
          COALESCE(employee.default_weekly_salary, 0) <= 0
          AND COALESCE(employee.service_hourly_rate,
                       employee.regular_hourly_rate, 0) <= 0
        WHEN employee.payroll_rule IN (
          'preset_40_weekly_salary', 'fixed_weekly_salary'
        ) THEN COALESCE(employee.default_weekly_salary, 0) <= 0
        ELSE false
      END,
      wage_review_reason = CASE
        WHEN employee.payroll_rule = 'unconfigured' THEN 'Requiere regla de pago'
        WHEN employee.payroll_rule IN (
          'standard_hourly_40_plus_services', 'preset_40_hourly'
        ) AND COALESCE(employee.regular_hourly_rate, 0) <= 0
          THEN 'Requiere tarifa'
        WHEN employee.payroll_rule = 'full_services'
         AND COALESCE(employee.default_weekly_salary, 0) <= 0
         AND COALESCE(employee.service_hourly_rate,
                      employee.regular_hourly_rate, 0) <= 0
          THEN 'Requiere tarifa'
        WHEN employee.payroll_rule IN (
          'preset_40_weekly_salary', 'fixed_weekly_salary'
        ) AND COALESCE(employee.default_weekly_salary, 0) <= 0
          THEN 'Configuración incompleta'
        ELSE NULL
      END
  WHERE employee.company_id = p_company_id;

  INSERT INTO public.tresbe_wage_review_items(
    company_id, report_date, review_key, official_name,
    source_name, employee_id, reason
  )
  SELECT employee.company_id, CURRENT_DATE,
         'master:' || employee.id::TEXT, employee.display_name,
         employee.source_name, employee.id, employee.wage_review_reason
  FROM public.tresbe_employees employee
  WHERE employee.company_id = p_company_id
    AND employee.is_active
    AND employee.wage_requires_review
  ON CONFLICT (company_id, report_date, review_key) DO UPDATE
    SET official_name = EXCLUDED.official_name,
        source_name = EXCLUDED.source_name,
        employee_id = EXCLUDED.employee_id,
        reason = EXCLUDED.reason,
        resolved_at = NULL,
        resolved_by = NULL;

  SELECT count(*) INTO v_count
  FROM public.tresbe_employees
  WHERE company_id = p_company_id
    AND is_active
    AND wage_requires_review;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_tresbe_employee_reviews(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payroll_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  deleted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 5 AND 500),
  payroll_snapshot JSONB NOT NULL,
  entries_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tresbe_payroll_deletion_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Tresbe payroll deletion events"
  ON public.tresbe_payroll_deletion_events;
CREATE POLICY "Admins read Tresbe payroll deletion events"
  ON public.tresbe_payroll_deletion_events FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id));
REVOKE INSERT, UPDATE, DELETE ON public.tresbe_payroll_deletion_events
  FROM anon, authenticated;
GRANT SELECT ON public.tresbe_payroll_deletion_events TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_tresbe_payroll_draft(
  p_payroll_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payroll public.tresbe_payrolls%ROWTYPE;
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete Tresbe payroll drafts';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Delete reason must contain between 5 and 500 characters';
  END IF;

  SELECT * INTO v_payroll
  FROM public.tresbe_payrolls
  WHERE id = p_payroll_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_tresbe_company(v_payroll.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll not found';
  END IF;
  IF v_payroll.status NOT IN ('draft', 'calculated')
     OR v_payroll.sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only never-sent Tresbe draft payrolls can be deleted';
  END IF;

  INSERT INTO public.tresbe_payroll_deletion_events(
    company_id, payroll_id, week_start, week_end, deleted_by, reason,
    payroll_snapshot, entries_snapshot
  ) VALUES (
    v_payroll.company_id, v_payroll.id, v_payroll.week_start,
    v_payroll.week_end, auth.uid(), v_reason, to_jsonb(v_payroll),
    COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY entry.employee_name_snapshot)
              FROM public.tresbe_payroll_entries entry
              WHERE entry.payroll_id = v_payroll.id), '[]'::JSONB)
  );

  DELETE FROM public.tresbe_payroll_events WHERE payroll_id = v_payroll.id;
  DELETE FROM public.tresbe_payroll_entries WHERE payroll_id = v_payroll.id;
  DELETE FROM public.tresbe_payrolls WHERE id = v_payroll.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tresbe_payroll_draft(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_tresbe_payroll_draft(UUID, TEXT)
  TO authenticated;

-- Submission validation only blocks incomplete employees who have payment activity.
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
    SELECT 1
    FROM public.tresbe_payroll_entries entry
    WHERE entry.payroll_id = p_payroll_id
      AND (
        entry.total_weekly_hours > 0 OR entry.manual_system_amount > 0
        OR entry.tips > 0 OR entry.fixed_service_amount > 0
        OR entry.other_adjustments <> 0 OR entry.employee_total <> 0
      )
      AND (
        entry.payroll_rule_snapshot = 'unconfigured'
        OR (entry.payroll_rule_snapshot IN (
              'standard_hourly_40_plus_services', 'preset_40_hourly'
            ) AND COALESCE(entry.regular_rate_snapshot, 0) <= 0)
        OR (entry.payroll_rule_snapshot = 'full_services'
            AND COALESCE(entry.weekly_salary_snapshot, 0) <= 0
            AND COALESCE(entry.service_rate_snapshot,
                         entry.regular_rate_snapshot, 0) <= 0
            AND entry.fixed_service_amount <= 0)
        OR (entry.payroll_rule_snapshot IN (
              'preset_40_weekly_salary', 'fixed_weekly_salary'
            ) AND COALESCE(entry.weekly_salary_snapshot, 0) <= 0)
        OR (entry.payroll_rule_snapshot IN (
              'standard_hourly_40_plus_services', 'preset_40_hourly'
            ) AND entry.fixed_service_amount > 0
            AND (entry.service_hours <= 0 OR
                 char_length(trim(COALESCE(entry.comment, ''))) < 5))
        OR (entry.payroll_rule_snapshot = 'custom_manual'
            AND (entry.manual_system_amount > 0 OR entry.fixed_service_amount > 0)
            AND char_length(trim(COALESCE(entry.comment, ''))) < 5)
        OR (entry.other_adjustments < 0
            AND char_length(trim(COALESCE(entry.comment, ''))) < 5)
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
      status = 'sent', sent_by = auth.uid(), sent_at = now(), viewed_at = NULL,
      pdf_storage_path = '/api/tresbe-payroll/' || payroll.id::TEXT || '/pdf',
      updated_by = auth.uid()
  FROM (
    SELECT count(*)::INTEGER employee_count,
      round(COALESCE(sum(total_weekly_hours), 0), 2) total_weekly_hours,
      round(COALESCE(sum(system_hours), 0), 2) total_system_hours,
      round(COALESCE(sum(service_hours), 0), 2) total_service_hours,
      round(COALESCE(sum(system_pay), 0), 2) total_system_pay,
      round(COALESCE(sum(tips), 0), 2) total_tips,
      round(COALESCE(sum(service_check_amount), 0), 2) total_service_checks,
      round(COALESCE(sum(other_adjustments), 0), 2) total_adjustments,
      round(COALESCE(sum(employee_total), 0), 2) grand_total,
      count(*) FILTER (WHERE employee_total <> 0) payment_count
    FROM public.tresbe_payroll_entries
    WHERE payroll_id = p_payroll_id
  ) totals
  WHERE payroll.id = p_payroll_id AND totals.payment_count > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tresbe payroll has no active payment data';
  END IF;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  VALUES (p_payroll_id, auth.uid(), 'sent_to_client');
END;
$$;

REVOKE ALL ON FUNCTION public.send_tresbe_payroll(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tresbe_payroll(UUID, TEXT, TEXT)
  TO authenticated;

DO $$
DECLARE
  v_company_id UUID;
  v_actor UUID;
  v_sofia_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE slug = 'tresbe';
  IF v_company_id IS NULL THEN RETURN; END IF;

  -- Apply the preceding idempotent alias reconciliation first.
  PERFORM public.reconcile_tresbe_employees_internal(v_company_id);

  SELECT created_by INTO v_actor
  FROM public.tresbe_payrolls
  WHERE company_id = v_company_id
  ORDER BY created_at
  LIMIT 1;

  UPDATE public.tresbe_employees
  SET payroll_rule = 'preset_40_hourly', payment_method = 'mixed',
      regular_hourly_rate = 16.25, service_hourly_rate = NULL,
      default_weekly_hours = 40, default_weekly_salary = NULL,
      annual_salary = NULL, wage_requires_review = false,
      wage_review_reason = NULL,
      wage_source = 'Confirmed Fernando correction 2026-07-14',
      wage_updated_at = now()
  WHERE company_id = v_company_id
    AND normalized_name = 'fernando almonte';

  INSERT INTO public.tresbe_employees(
    company_id, first_name, last_name, display_name, normalized_name,
    source_name, area, payment_method, payroll_rule, is_active,
    wage_requires_review, wage_review_reason, wage_source,
    created_by, updated_by
  )
  SELECT v_company_id, 'Sofia', NULL, 'Sofia', 'sofia',
         'Manual operational directory', 'Sin asignar', 'manual',
         'unconfigured', true, true, 'Requiere regla de pago',
         'Manual operational directory', v_actor, v_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'sofia'
  );

  SELECT id INTO v_sofia_id FROM public.tresbe_employees
  WHERE company_id = v_company_id AND normalized_name = 'sofia';
  UPDATE public.tresbe_employees
  SET is_active = true
  WHERE id = v_sofia_id AND NOT is_active;

  -- Backfill every active employee into every open payroll exactly once.
  INSERT INTO public.tresbe_payroll_entries(
    payroll_id, employee_id, employee_name_snapshot, area_snapshot,
    payment_method_snapshot, payroll_rule_snapshot,
    receives_proportional_tips_snapshot, regular_rate_snapshot,
    service_rate_snapshot, weekly_salary_snapshot, total_weekly_hours,
    is_new_employee
  )
  SELECT payroll.id, employee.id, employee.display_name, employee.area,
         employee.payment_method, employee.payroll_rule,
         employee.receives_proportional_tips, employee.regular_hourly_rate,
         employee.service_hourly_rate, employee.default_weekly_salary,
         COALESCE(employee.default_weekly_hours, 0), true
  FROM public.tresbe_payrolls payroll
  JOIN public.tresbe_employees employee
    ON employee.company_id = payroll.company_id AND employee.is_active
  WHERE payroll.company_id = v_company_id
    AND payroll.status IN ('draft', 'calculated', 'corrected')
  ON CONFLICT (payroll_id, employee_id) DO NOTHING;

  UPDATE public.tresbe_payroll_entries entry
  SET total_weekly_hours = 40,
      payroll_rule_snapshot = 'preset_40_hourly',
      payment_method_snapshot = 'mixed',
      regular_rate_snapshot = 16.25,
      service_rate_snapshot = NULL,
      weekly_salary_snapshot = NULL
  FROM public.tresbe_payrolls payroll,
       public.tresbe_employees employee
  WHERE payroll.id = entry.payroll_id
    AND employee.id = entry.employee_id
    AND employee.company_id = v_company_id
    AND employee.normalized_name = 'fernando almonte'
    AND payroll.status IN ('draft', 'calculated', 'corrected')
    AND entry.total_weekly_hours IN (0, 40);

  PERFORM public.refresh_tresbe_employee_reviews(v_company_id);
END;
$$;

DO $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE slug = 'tresbe';
  IF v_company_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'fernando almonte'
      AND NOT (payroll_rule = 'preset_40_hourly'
               AND regular_hourly_rate = 16.25
               AND default_weekly_hours = 40
               AND default_weekly_salary IS NULL)
  ) THEN RAISE EXCEPTION 'Fernando Almonte stabilization failed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees
    WHERE company_id = v_company_id AND normalized_name = 'sofia' AND is_active
  ) THEN RAISE EXCEPTION 'Sofia stabilization failed'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tresbe_payrolls payroll
    JOIN public.tresbe_employees employee
      ON employee.company_id = payroll.company_id AND employee.is_active
    WHERE payroll.company_id = v_company_id
      AND payroll.status IN ('draft', 'calculated', 'corrected')
      AND NOT EXISTS (
        SELECT 1 FROM public.tresbe_payroll_entries entry
        WHERE entry.payroll_id = payroll.id
          AND entry.employee_id = employee.id
      )
  ) THEN RAISE EXCEPTION 'Open Tresbe payroll is missing active employees'; END IF;
END;
$$;
