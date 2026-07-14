-- Reconcile confirmed Tresbe aliases from the master directory. This migration
-- never creates employees and never changes closed payroll snapshots.

CREATE TABLE IF NOT EXISTS public.tresbe_employee_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  alias_name TEXT NOT NULL CHECK (char_length(trim(alias_name)) BETWEEN 1 AND 202),
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Confirmed administrator mapping',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS tresbe_employee_aliases_employee_idx
  ON public.tresbe_employee_aliases(employee_id);

ALTER TABLE public.tresbe_employee_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Tresbe employee aliases"
  ON public.tresbe_employee_aliases;
CREATE POLICY "Admins read Tresbe employee aliases"
  ON public.tresbe_employee_aliases FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id));
REVOKE INSERT, UPDATE, DELETE ON public.tresbe_employee_aliases FROM authenticated;

CREATE OR REPLACE FUNCTION public.validate_tresbe_employee_alias_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_employees employee
    WHERE employee.id = NEW.employee_id
      AND employee.company_id = NEW.company_id
      AND public.is_tresbe_company(employee.company_id)
  ) THEN
    RAISE EXCEPTION 'Tresbe employee alias company mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_employee_alias_company_integrity
  ON public.tresbe_employee_aliases;
CREATE TRIGGER tresbe_employee_alias_company_integrity
  BEFORE INSERT OR UPDATE OF company_id, employee_id
  ON public.tresbe_employee_aliases
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_employee_alias_company();

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
    WHEN 'preset_40_hourly' THEN
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
        ELSE round(NEW.service_hours * v_service_rate, 2)
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

CREATE OR REPLACE FUNCTION public.validate_tresbe_preset_hourly_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS (
    SELECT 1
    FROM public.tresbe_payroll_entries entry
    WHERE entry.payroll_id = NEW.id
      AND entry.payroll_rule_snapshot = 'preset_40_hourly'
      AND (
        (entry.total_weekly_hours > 0
         AND COALESCE(entry.regular_rate_snapshot, 0) <= 0)
        OR (entry.fixed_service_amount > 0 AND entry.service_hours <= 0)
        OR (entry.fixed_service_amount > 0
            AND char_length(trim(COALESCE(entry.comment, ''))) < 5)
      )
  ) THEN
    RAISE EXCEPTION 'Tresbe payroll contains invalid preset hourly payment data';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_validate_preset_hourly_send
  ON public.tresbe_payrolls;
CREATE TRIGGER tresbe_validate_preset_hourly_send
  BEFORE UPDATE OF status ON public.tresbe_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_preset_hourly_send();

CREATE OR REPLACE FUNCTION public.reconcile_tresbe_employees_internal(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapping RECORD;
  duplicate_employee RECORD;
  alias_value TEXT;
  target_id UUID;
  merged_count INTEGER := 0;
  alias_count INTEGER := 0;
  resolved_count INTEGER := 0;
  review_count INTEGER := 0;
  active_count INTEGER := 0;
BEGIN
  IF NOT public.is_tresbe_company(p_company_id) THEN
    RAISE EXCEPTION 'Tresbe company not found';
  END IF;

  PERFORM set_config(
    'app.tresbe_wage_source',
    'Confirmed alias reconciliation 2026-07-14',
    true
  );

  FOR mapping IN
    SELECT * FROM (VALUES
      ('Jared', 'Rivera Rodriguez', 'jared rivera rodriguez',
       ARRAY['jared rivera', 'jared rivera rodriguez', 'rivera rodriguez, jared']::TEXT[],
       'RIVERA RODRIGUEZ, JARED', 10.50::NUMERIC,
       'standard_hourly_40_plus_services'::public.tresbe_payroll_rule),
      ('Lee J.', 'de Jesus Sanchez', 'lee j. de jesus sanchez',
       ARRAY['lee sanchez', 'sanchez lee j', 'lee j. de jesus sanchez',
             'de jesus sanchez, lee j.']::TEXT[],
       'DE JESUS SANCHEZ, LEE J.', 11.00::NUMERIC,
       'standard_hourly_40_plus_services'::public.tresbe_payroll_rule),
      ('Lee', 'Pierre', 'lee pierre',
       ARRAY['lee pierre', 'lee zephyrus p. irene',
             'irene, lee zephyrinus p.']::TEXT[],
       'Lee Zephyrus P. Irene', 13.00::NUMERIC,
       'standard_hourly_40_plus_services'::public.tresbe_payroll_rule),
      ('Regino', 'Pizarro', 'regino pizarro',
       ARRAY['regino', 'regino pizarro', 'pizarro, regino']::TEXT[],
       'PIZARRO, REGINO', 13.00::NUMERIC,
       'standard_hourly_40_plus_services'::public.tresbe_payroll_rule),
      ('Carlos', 'Ramos', 'carlos ramos',
       ARRAY['carlos ramos']::TEXT[], 'Carlos Ramos', NULL::NUMERIC,
       'full_services'::public.tresbe_payroll_rule)
    ) AS valueset(
      first_name, last_name, canonical_name, aliases, source_name,
      hourly_rate, payroll_rule
    )
  LOOP
    SELECT employee.id INTO target_id
    FROM public.tresbe_employees employee
    WHERE employee.company_id = p_company_id
      AND (
        employee.normalized_name = ANY(mapping.aliases)
        OR lower(regexp_replace(trim(COALESCE(employee.source_name, '')), '\s+', ' ', 'g'))
           = ANY(mapping.aliases)
      )
    ORDER BY
      (employee.normalized_name = mapping.canonical_name) DESC,
      employee.is_active DESC,
      employee.created_at
    LIMIT 1;

    IF target_id IS NULL THEN CONTINUE; END IF;

    FOR alias_value IN ARRAY mapping.aliases LOOP
      INSERT INTO public.tresbe_employee_aliases(
        company_id, employee_id, alias_name, normalized_alias
      ) VALUES (
        p_company_id, target_id, alias_value,
        lower(regexp_replace(trim(alias_value), '\s+', ' ', 'g'))
      )
      ON CONFLICT (company_id, normalized_alias) DO UPDATE
        SET employee_id = EXCLUDED.employee_id,
            alias_name = EXCLUDED.alias_name;
      alias_count := alias_count + 1;
    END LOOP;

    FOR duplicate_employee IN
      SELECT employee.id, employee.display_name, employee.source_name
      FROM public.tresbe_employees employee
      WHERE employee.company_id = p_company_id
        AND employee.id <> target_id
        AND employee.is_active
        AND (
          employee.normalized_name = ANY(mapping.aliases)
          OR lower(regexp_replace(trim(COALESCE(employee.source_name, '')), '\s+', ' ', 'g'))
             = ANY(mapping.aliases)
        )
    LOOP
      UPDATE public.tresbe_payroll_entries target
      SET total_weekly_hours = CASE
            WHEN target.total_weekly_hours = 0 THEN source.total_weekly_hours
            ELSE target.total_weekly_hours END,
          tips = CASE WHEN target.tips = 0 THEN source.tips ELSE target.tips END,
          fixed_service_amount = CASE
            WHEN target.fixed_service_amount = 0 THEN source.fixed_service_amount
            ELSE target.fixed_service_amount END,
          other_adjustments = CASE
            WHEN target.other_adjustments = 0 THEN source.other_adjustments
            ELSE target.other_adjustments END,
          comment = COALESCE(target.comment, source.comment)
      FROM public.tresbe_payroll_entries source,
           public.tresbe_payrolls payroll
      WHERE source.employee_id = duplicate_employee.id
        AND target.employee_id = target_id
        AND target.payroll_id = source.payroll_id
        AND payroll.id = target.payroll_id
        AND payroll.status IN ('draft', 'calculated', 'corrected');

      UPDATE public.tresbe_payroll_entries entry
      SET employee_id = target_id
      FROM public.tresbe_payrolls payroll
      WHERE entry.employee_id = duplicate_employee.id
        AND payroll.id = entry.payroll_id
        AND payroll.status IN ('draft', 'calculated', 'corrected')
        AND NOT EXISTS (
          SELECT 1 FROM public.tresbe_payroll_entries existing
          WHERE existing.payroll_id = entry.payroll_id
            AND existing.employee_id = target_id
        );

      DELETE FROM public.tresbe_payroll_entries entry
      USING public.tresbe_payrolls payroll
      WHERE entry.employee_id = duplicate_employee.id
        AND payroll.id = entry.payroll_id
        AND payroll.status IN ('draft', 'calculated', 'corrected');

      UPDATE public.tresbe_wage_review_items
      SET employee_id = target_id
      WHERE company_id = p_company_id
        AND employee_id = duplicate_employee.id;

      UPDATE public.tresbe_employees
      SET is_active = false,
          internal_note = concat_ws(
            E'\n', NULLIF(internal_note, ''),
            'Alias merged into ' || mapping.canonical_name || ' on 2026-07-14.'
          )
      WHERE id = duplicate_employee.id;
      merged_count := merged_count + 1;
    END LOOP;

    UPDATE public.tresbe_employees employee
    SET first_name = mapping.first_name,
        last_name = mapping.last_name,
        source_name = mapping.source_name,
        payroll_rule = mapping.payroll_rule,
        payment_method = CASE
          WHEN mapping.payroll_rule = 'full_services' THEN 'services'
          ELSE 'mixed'
        END,
        regular_hourly_rate = COALESCE(mapping.hourly_rate, employee.regular_hourly_rate),
        service_hourly_rate = CASE
          WHEN mapping.payroll_rule = 'full_services'
            THEN COALESCE(employee.service_hourly_rate, mapping.hourly_rate,
                          employee.regular_hourly_rate)
          ELSE employee.service_hourly_rate
        END,
        default_weekly_salary = CASE
          WHEN mapping.canonical_name = 'carlos ramos' THEN NULL
          WHEN mapping.payroll_rule = 'full_services'
            THEN employee.default_weekly_salary
          ELSE NULL
        END,
        annual_salary = NULL,
        is_active = true,
        wage_requires_review = false,
        wage_review_reason = NULL,
        wage_source = 'Confirmed alias reconciliation 2026-07-14',
        wage_updated_at = now()
    WHERE employee.id = target_id;

    IF mapping.canonical_name = 'carlos ramos' THEN
      UPDATE public.tresbe_employees SET area = 'Mesero' WHERE id = target_id;
    END IF;
  END LOOP;

  -- Fernando is hourly with a 40-hour default, not a fixed weekly salary.
  UPDATE public.tresbe_employees
  SET payroll_rule = 'preset_40_hourly',
      payment_method = 'mixed',
      regular_hourly_rate = 16.25,
      service_hourly_rate = NULL,
      default_weekly_hours = 40,
      default_weekly_salary = NULL,
      annual_salary = NULL,
      wage_requires_review = false,
      wage_review_reason = NULL,
      wage_source = 'Confirmed correction 2026-07-14',
      wage_updated_at = now()
  WHERE company_id = p_company_id
    AND normalized_name = 'fernando almonte';

  -- Reassert permanent full-service arrangements without inventing unknown wages.
  UPDATE public.tresbe_employees employee
  SET payroll_rule = 'full_services',
      payment_method = 'services',
      regular_hourly_rate = CASE employee.normalized_name
        WHEN 'leslie a. ruiz santiago' THEN 5.00
        WHEN 'nashely' THEN 4.50
        WHEN 'julian mateo' THEN 10.00
        ELSE employee.regular_hourly_rate
      END,
      service_hourly_rate = CASE employee.normalized_name
        WHEN 'leslie a. ruiz santiago' THEN 5.00
        WHEN 'nashely' THEN 4.50
        WHEN 'julian mateo' THEN 10.00
        WHEN 'ramon luis rivera' THEN NULL
        ELSE COALESCE(employee.service_hourly_rate, employee.regular_hourly_rate)
      END,
      default_weekly_salary = CASE
        WHEN employee.normalized_name = 'ramon luis rivera' THEN 220.00
        ELSE employee.default_weekly_salary
      END,
      area = CASE
        WHEN employee.normalized_name = 'ramon luis rivera' THEN 'Seguridad'
        WHEN employee.normalized_name = 'carlos ramos' THEN 'Mesero'
        ELSE employee.area
      END,
      wage_requires_review = false,
      wage_review_reason = NULL,
      wage_source = 'Confirmed full-service configuration 2026-07-14',
      wage_updated_at = now()
  WHERE employee.company_id = p_company_id
    AND employee.normalized_name IN (
      'leslie a. ruiz santiago', 'nashely', 'julian mateo',
      'yediel', 'carlos ramos', 'ramon luis rivera'
    );

  -- Fernando's old fixed entry used zero hours. Preserve any hours already entered.
  UPDATE public.tresbe_payroll_entries entry
  SET total_weekly_hours = 40
  FROM public.tresbe_payrolls payroll,
       public.tresbe_employees employee
  WHERE employee.company_id = p_company_id
    AND employee.normalized_name = 'fernando almonte'
    AND entry.employee_id = employee.id
    AND payroll.id = entry.payroll_id
    AND payroll.status IN ('draft', 'calculated', 'corrected')
    AND entry.total_weekly_hours = 0;

  -- Refresh every open snapshot from the active master. Closed snapshots are untouched.
  UPDATE public.tresbe_payroll_entries entry
  SET employee_name_snapshot = employee.display_name,
      area_snapshot = employee.area,
      payment_method_snapshot = employee.payment_method,
      payroll_rule_snapshot = employee.payroll_rule,
      receives_proportional_tips_snapshot = employee.receives_proportional_tips,
      regular_rate_snapshot = employee.regular_hourly_rate,
      service_rate_snapshot = employee.service_hourly_rate,
      weekly_salary_snapshot = employee.default_weekly_salary
  FROM public.tresbe_employees employee,
       public.tresbe_payrolls payroll
  WHERE entry.employee_id = employee.id
    AND payroll.id = entry.payroll_id
    AND employee.company_id = p_company_id
    AND payroll.status IN ('draft', 'calculated', 'corrected');

  -- Rebuild reviews from the current master instead of report membership.
  UPDATE public.tresbe_wage_review_items
  SET resolved_at = COALESCE(resolved_at, now()),
      resolved_by = COALESCE(resolved_by, auth.uid())
  WHERE company_id = p_company_id AND resolved_at IS NULL;
  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  UPDATE public.tresbe_employees employee
  SET wage_requires_review = (
        employee.payroll_rule = 'unconfigured'
        OR (employee.payroll_rule IN (
              'standard_hourly_40_plus_services', 'preset_40_hourly'
            ) AND COALESCE(employee.regular_hourly_rate, 0) <= 0)
        OR (employee.payroll_rule = 'full_services'
            AND COALESCE(employee.default_weekly_salary, 0) <= 0
            AND COALESCE(employee.service_hourly_rate,
                         employee.regular_hourly_rate, 0) <= 0)
        OR (employee.payroll_rule IN (
              'preset_40_weekly_salary', 'fixed_weekly_salary'
            ) AND COALESCE(employee.default_weekly_salary, 0) <= 0)
      ),
      wage_review_reason = CASE
        WHEN employee.payroll_rule = 'unconfigured' THEN 'Falta regla de nómina'
        WHEN employee.payroll_rule IN (
               'standard_hourly_40_plus_services', 'preset_40_hourly'
             ) AND COALESCE(employee.regular_hourly_rate, 0) <= 0
          THEN 'Falta tarifa por hora'
        WHEN employee.payroll_rule = 'full_services'
             AND COALESCE(employee.default_weekly_salary, 0) <= 0
             AND COALESCE(employee.service_hourly_rate,
                          employee.regular_hourly_rate, 0) <= 0
          THEN 'Falta compensación de servicios'
        WHEN employee.payroll_rule IN (
               'preset_40_weekly_salary', 'fixed_weekly_salary'
             ) AND COALESCE(employee.default_weekly_salary, 0) <= 0
          THEN 'Falta salario semanal'
        ELSE NULL
      END
  WHERE employee.company_id = p_company_id
    AND employee.is_active;

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

  SELECT count(*) INTO review_count
  FROM public.tresbe_employees
  WHERE company_id = p_company_id AND is_active AND wage_requires_review;
  SELECT count(*) INTO active_count
  FROM public.tresbe_employees
  WHERE company_id = p_company_id AND is_active;

  RETURN jsonb_build_object(
    'aliases_recorded', alias_count,
    'duplicate_records_merged', merged_count,
    'review_items_resolved', resolved_count,
    'employees_requiring_review', review_count,
    'active_employee_count', active_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_tresbe_employees_internal(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_tresbe_employees(
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reconcile Tresbe employees';
  END IF;
  IF NOT public.is_tresbe_company(p_company_id) THEN
    RAISE EXCEPTION 'Tresbe company not found';
  END IF;
  RETURN public.reconcile_tresbe_employees_internal(p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_tresbe_employees(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_tresbe_employees(UUID)
  TO authenticated;

-- Apply once during deployment; the same idempotent routine powers the admin action.
DO $$
DECLARE
  tresbe_company_id UUID;
BEGIN
  SELECT id INTO tresbe_company_id FROM public.companies WHERE slug = 'tresbe';
  IF tresbe_company_id IS NOT NULL THEN
    PERFORM public.reconcile_tresbe_employees_internal(tresbe_company_id);
  END IF;
END;
$$;

DO $$
DECLARE
  tresbe_company_id UUID;
BEGIN
  SELECT id INTO tresbe_company_id FROM public.companies WHERE slug = 'tresbe';
  IF tresbe_company_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.tresbe_employees employee
    WHERE employee.company_id = tresbe_company_id
      AND employee.normalized_name = 'fernando almonte'
      AND NOT (
        employee.payroll_rule = 'preset_40_hourly'
        AND employee.regular_hourly_rate = 16.25
        AND employee.default_weekly_hours = 40
        AND employee.default_weekly_salary IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Fernando Almonte reconciliation failed';
  END IF;

  IF EXISTS (
    SELECT normalized_alias
    FROM public.tresbe_employee_aliases
    WHERE company_id = tresbe_company_id
    GROUP BY normalized_alias HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Tresbe alias uniqueness validation failed';
  END IF;
END;
$$;
