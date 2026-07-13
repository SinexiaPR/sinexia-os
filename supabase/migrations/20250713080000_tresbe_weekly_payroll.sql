-- Tresbe-only weekly payroll preparation, publication, audit and tenant isolation.

DO $$ BEGIN
  CREATE TYPE public.tresbe_payroll_rule AS ENUM (
    'unconfigured',
    'standard_hourly_40_plus_services',
    'full_services',
    'preset_40_weekly_salary',
    'fixed_weekly_salary',
    'custom_manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tresbe_payroll_status AS ENUM (
    'draft', 'calculated', 'sent', 'viewed', 'corrected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.is_tresbe_company(value UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = value AND slug = 'tresbe'
  );
$$;

CREATE TABLE IF NOT EXISTS public.tresbe_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL CHECK (char_length(trim(first_name)) BETWEEN 1 AND 80),
  last_name TEXT CHECK (
    last_name IS NULL OR char_length(trim(last_name)) BETWEEN 1 AND 120
  ),
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 202),
  normalized_name TEXT NOT NULL,
  source_name TEXT,
  area TEXT NOT NULL CHECK (char_length(trim(area)) BETWEEN 1 AND 100),
  payment_method TEXT NOT NULL DEFAULT 'manual' CHECK (
    payment_method IN ('payroll_system', 'services', 'mixed', 'manual')
  ),
  payroll_rule public.tresbe_payroll_rule NOT NULL DEFAULT 'unconfigured',
  receives_proportional_tips BOOLEAN NOT NULL DEFAULT false,
  regular_hourly_rate NUMERIC(12,2) CHECK (
    regular_hourly_rate IS NULL OR regular_hourly_rate >= 0
  ),
  service_hourly_rate NUMERIC(12,2) CHECK (
    service_hourly_rate IS NULL OR service_hourly_rate >= 0
  ),
  default_weekly_hours NUMERIC(8,2) CHECK (
    default_weekly_hours IS NULL OR default_weekly_hours >= 0
  ),
  default_weekly_salary NUMERIC(12,2) CHECK (
    default_weekly_salary IS NULL OR default_weekly_salary >= 0
  ),
  is_active BOOLEAN NOT NULL DEFAULT true,
  internal_note TEXT CHECK (
    internal_note IS NULL OR char_length(internal_note) <= 1000
  ),
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.tresbe_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status public.tresbe_payroll_status NOT NULL DEFAULT 'draft',
  employee_count INTEGER NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  total_weekly_hours NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_system_hours NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_service_hours NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_system_pay NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tips NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_service_checks NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_adjustments NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  admin_note TEXT CHECK (admin_note IS NULL OR char_length(admin_note) <= 2000),
  client_note TEXT CHECK (client_note IS NULL OR char_length(client_note) <= 2000),
  supporting_document_id UUID REFERENCES public.documents(id) ON DELETE RESTRICT,
  pdf_storage_path TEXT,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  email_recipient TEXT,
  email_status TEXT CHECK (
    email_status IS NULL OR email_status IN ('not_configured', 'pending', 'sent', 'failed')
  ),
  email_sent_at TIMESTAMPTZ,
  email_sent_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  email_provider_message_id TEXT,
  email_error TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (week_end = week_start + 6),
  CHECK (total_weekly_hours >= 0 AND total_system_hours >= 0 AND total_service_hours >= 0),
  CHECK (total_system_pay >= 0 AND total_tips >= 0 AND total_service_checks >= 0),
  CHECK (grand_total = round(total_system_pay + total_tips + total_service_checks + total_adjustments, 2)),
  UNIQUE(company_id, week_start, week_end)
);

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.tresbe_payrolls(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  employee_name_snapshot TEXT NOT NULL,
  area_snapshot TEXT NOT NULL,
  payment_method_snapshot TEXT NOT NULL,
  payroll_rule_snapshot public.tresbe_payroll_rule NOT NULL,
  receives_proportional_tips_snapshot BOOLEAN NOT NULL DEFAULT false,
  regular_rate_snapshot NUMERIC(12,2),
  service_rate_snapshot NUMERIC(12,2),
  weekly_salary_snapshot NUMERIC(12,2),
  is_new_employee BOOLEAN NOT NULL DEFAULT false,
  total_weekly_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (total_weekly_hours >= 0),
  system_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (system_hours >= 0),
  service_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (service_hours >= 0),
  manual_system_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (manual_system_amount >= 0),
  system_pay NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (system_pay >= 0),
  tips NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tips >= 0),
  fixed_service_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fixed_service_amount >= 0),
  service_check_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_check_amount >= 0),
  other_adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_reason TEXT CHECK (
    service_reason IS NULL OR service_reason IN (
      'Horas sobre 40', 'Empleado por servicios', 'Ajuste manual', 'Otro'
    )
  ),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (employee_total = round(system_pay + tips + service_check_amount + other_adjustments, 2)),
  CHECK (other_adjustments >= 0 OR char_length(trim(COALESCE(comment, ''))) >= 5),
  UNIQUE(payroll_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.tresbe_payrolls(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'draft_created', 'employee_added', 'recalculated', 'pdf_generated',
    'sent_to_client', 'email_sent', 'email_failed', 'client_viewed',
    'payroll_cancelled', 'service_override'
  )),
  content TEXT CHECK (content IS NULL OR char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  default_email_recipient TEXT,
  email_cc TEXT,
  email_subject_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tresbe_employees_company_active_idx
  ON public.tresbe_employees(company_id, is_active, normalized_name);
CREATE INDEX IF NOT EXISTS tresbe_payrolls_company_period_idx
  ON public.tresbe_payrolls(company_id, week_start DESC);
CREATE INDEX IF NOT EXISTS tresbe_payrolls_client_visible_idx
  ON public.tresbe_payrolls(company_id, sent_at DESC)
  WHERE status IN ('sent', 'viewed', 'corrected');
CREATE INDEX IF NOT EXISTS tresbe_payroll_entries_payroll_idx
  ON public.tresbe_payroll_entries(payroll_id);
CREATE INDEX IF NOT EXISTS tresbe_payroll_events_payroll_idx
  ON public.tresbe_payroll_events(payroll_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.normalize_tresbe_employee_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.first_name := regexp_replace(trim(NEW.first_name), '\s+', ' ', 'g');
  NEW.last_name := NULLIF(regexp_replace(trim(COALESCE(NEW.last_name, '')), '\s+', ' ', 'g'), '');
  NEW.display_name := trim(NEW.first_name || COALESCE(' ' || NEW.last_name, ''));
  NEW.normalized_name := lower(regexp_replace(NEW.display_name, '\s+', ' ', 'g'));
  NEW.source_name := NULLIF(regexp_replace(trim(COALESCE(NEW.source_name, '')), '\s+', ' ', 'g'), '');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_employee_normalize_fields ON public.tresbe_employees;
CREATE TRIGGER tresbe_employee_normalize_fields
  BEFORE INSERT OR UPDATE OF first_name, last_name, source_name
  ON public.tresbe_employees
  FOR EACH ROW EXECUTE FUNCTION public.normalize_tresbe_employee_fields();

DROP TRIGGER IF EXISTS tresbe_employees_updated_at ON public.tresbe_employees;
CREATE TRIGGER tresbe_employees_updated_at
  BEFORE UPDATE ON public.tresbe_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tresbe_payrolls_updated_at ON public.tresbe_payrolls;
CREATE TRIGGER tresbe_payrolls_updated_at
  BEFORE UPDATE ON public.tresbe_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tresbe_payroll_entries_updated_at ON public.tresbe_payroll_entries;
CREATE TRIGGER tresbe_payroll_entries_updated_at
  BEFORE UPDATE ON public.tresbe_payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tresbe_payroll_settings_updated_at ON public.tresbe_payroll_settings;
CREATE TRIGGER tresbe_payroll_settings_updated_at
  BEFORE UPDATE ON public.tresbe_payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_tresbe_employee_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tresbe_company(NEW.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll employees must belong to Tresbe';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_employee_company_integrity ON public.tresbe_employees;
CREATE TRIGGER tresbe_employee_company_integrity
  BEFORE INSERT OR UPDATE OF company_id ON public.tresbe_employees
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_employee_company();

CREATE OR REPLACE FUNCTION public.validate_tresbe_payroll_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tresbe_company(NEW.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll must belong to Tresbe';
  END IF;
  IF NEW.supporting_document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documents d
     WHERE d.id = NEW.supporting_document_id AND d.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Supporting document must belong to payroll company';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_company_integrity ON public.tresbe_payrolls;
CREATE TRIGGER tresbe_payroll_company_integrity
  BEFORE INSERT OR UPDATE OF company_id, supporting_document_id
  ON public.tresbe_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_payroll_company();

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
    WHEN 'unconfigured' THEN
      NULL;
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
DROP TRIGGER IF EXISTS tresbe_payroll_entry_calculation ON public.tresbe_payroll_entries;
CREATE TRIGGER tresbe_payroll_entry_calculation
  BEFORE INSERT OR UPDATE ON public.tresbe_payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.calculate_tresbe_payroll_entry();

CREATE OR REPLACE FUNCTION public.protect_tresbe_payroll_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_payroll_id UUID := COALESCE(NEW.payroll_id, OLD.payroll_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = v_payroll_id
       AND p.status NOT IN ('draft', 'calculated', 'corrected')
  ) THEN
    RAISE EXCEPTION 'Sent or cancelled Tresbe payroll entries are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_entries_immutable ON public.tresbe_payroll_entries;
CREATE TRIGGER tresbe_payroll_entries_immutable
  BEFORE UPDATE OR DELETE ON public.tresbe_payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_tresbe_payroll_entries();

CREATE OR REPLACE FUNCTION public.validate_tresbe_payroll_entry_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.tresbe_payrolls p
      JOIN public.tresbe_employees e ON e.id = NEW.employee_id
     WHERE p.id = NEW.payroll_id
       AND p.company_id = e.company_id
       AND public.is_tresbe_company(p.company_id)
  ) THEN
    RAISE EXCEPTION 'Tresbe payroll employee does not match payroll company';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_entry_company_integrity
  ON public.tresbe_payroll_entries;
CREATE TRIGGER tresbe_payroll_entry_company_integrity
  BEFORE INSERT OR UPDATE OF payroll_id, employee_id
  ON public.tresbe_payroll_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_payroll_entry_company();

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
    NEW.id, e.id, e.display_name, e.area,
    e.payment_method, e.payroll_rule, e.receives_proportional_tips,
    e.regular_hourly_rate,
    e.service_hourly_rate, e.default_weekly_salary,
    CASE
      WHEN e.payroll_rule = 'preset_40_weekly_salary' THEN 40
      ELSE COALESCE(e.default_weekly_hours, 0)
    END
  FROM public.tresbe_employees e
  WHERE e.company_id = NEW.company_id AND e.is_active
  ON CONFLICT (payroll_id, employee_id) DO NOTHING;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  VALUES (NEW.id, NEW.created_by, 'draft_created');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_load_employees ON public.tresbe_payrolls;
CREATE TRIGGER tresbe_payroll_load_employees
  AFTER INSERT ON public.tresbe_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.load_tresbe_payroll_employees();

CREATE OR REPLACE FUNCTION public.sync_tresbe_employee_to_open_payrolls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active AND NOT OLD.is_active) THEN
    INSERT INTO public.tresbe_payroll_entries (
      payroll_id, employee_id, employee_name_snapshot, area_snapshot,
      payment_method_snapshot, payroll_rule_snapshot,
      receives_proportional_tips_snapshot, regular_rate_snapshot,
      service_rate_snapshot, weekly_salary_snapshot, total_weekly_hours,
      is_new_employee
    )
    SELECT
      p.id, NEW.id, NEW.display_name, NEW.area,
      NEW.payment_method, NEW.payroll_rule, NEW.receives_proportional_tips,
      NEW.regular_hourly_rate,
      NEW.service_hourly_rate, NEW.default_weekly_salary,
      CASE
        WHEN NEW.payroll_rule = 'preset_40_weekly_salary' THEN 40
        ELSE COALESCE(NEW.default_weekly_hours, 0)
      END,
      true
    FROM public.tresbe_payrolls p
    WHERE p.company_id = NEW.company_id
      AND p.status IN ('draft', 'calculated', 'corrected')
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
           weekly_salary_snapshot = NEW.default_weekly_salary
      FROM public.tresbe_payrolls payroll
     WHERE entry.payroll_id = payroll.id
       AND entry.employee_id = NEW.id
       AND payroll.status IN ('draft', 'calculated', 'corrected');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_employee_sync_open_payrolls ON public.tresbe_employees;
CREATE TRIGGER tresbe_employee_sync_open_payrolls
  AFTER INSERT OR UPDATE ON public.tresbe_employees
  FOR EACH ROW EXECUTE FUNCTION public.sync_tresbe_employee_to_open_payrolls();

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
        round(COALESCE(sum(tips), 0), 2) AS total_tips,
        round(COALESCE(sum(service_check_amount), 0), 2) AS total_service_checks,
        round(COALESCE(sum(other_adjustments), 0), 2) AS total_adjustments,
        round(COALESCE(sum(employee_total), 0), 2) AS grand_total
      FROM public.tresbe_payroll_entries WHERE payroll_id = p_payroll_id
    ) totals
   WHERE payroll.id = p_payroll_id;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  VALUES (p_payroll_id, auth.uid(), 'recalculated');
END;
$$;

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
         AND e.fixed_service_amount > 0
         AND e.service_hours <= 0) OR
       (e.payroll_rule_snapshot = 'standard_hourly_40_plus_services'
         AND e.fixed_service_amount > 0
         AND char_length(trim(COALESCE(e.comment, ''))) < 5) OR
       (e.payroll_rule_snapshot = 'full_services'
         AND e.fixed_service_amount <= 0
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

CREATE OR REPLACE FUNCTION public.cancel_tresbe_payroll(
  p_payroll_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can cancel Tresbe payroll';
  END IF;
  IF char_length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;
  UPDATE public.tresbe_payrolls
     SET status = 'cancelled', updated_by = auth.uid()
   WHERE id = p_payroll_id AND public.is_tresbe_company(company_id)
     AND status IN ('draft', 'calculated', 'corrected');
  IF NOT FOUND THEN RAISE EXCEPTION 'Tresbe payroll cannot be cancelled'; END IF;
  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type, content)
  VALUES (p_payroll_id, auth.uid(), 'payroll_cancelled', trim(p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_tresbe_payroll_viewed(p_payroll_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RAISE EXCEPTION 'Only the Tresbe client can mark payroll viewed';
  END IF;
  SELECT company_id INTO v_company_id FROM public.tresbe_payrolls
   WHERE id = p_payroll_id
     AND status IN ('sent', 'viewed', 'corrected')
     AND company_id = public.current_company_id()
     AND public.is_tresbe_company(company_id)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tresbe payroll not found'; END IF;

  UPDATE public.tresbe_payrolls
     SET status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
         viewed_at = COALESCE(viewed_at, now())
   WHERE id = p_payroll_id;

  INSERT INTO public.tresbe_payroll_events(payroll_id, user_id, event_type)
  SELECT p_payroll_id, auth.uid(), 'client_viewed'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tresbe_payroll_events
     WHERE payroll_id = p_payroll_id AND user_id = auth.uid()
       AND event_type = 'client_viewed'
  );

  INSERT INTO public.notification_reads(notification_id, user_id, read_at)
  SELECT n.id, auth.uid(), now()
    FROM public.notifications n
   WHERE n.company_id = v_company_id
     AND n.audience = 'client'
     AND n.kind = 'tresbe_payroll_sent'
     AND n.href = '/dashboard/payroll?payroll=' || p_payroll_id::TEXT
  ON CONFLICT (notification_id, user_id)
  DO UPDATE SET read_at = EXCLUDED.read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_tresbe_payroll_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (
      dedupe_key, audience, kind, company_id, title, description, href
    ) VALUES (
      'tresbe_payroll_sent:' || NEW.id::TEXT || ':' ||
        to_char(NEW.sent_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS'),
      'client',
      'tresbe_payroll_sent',
      NEW.company_id,
      'Nueva nómina disponible',
      'Periodo ' || to_char(NEW.week_start, 'DD/MM/YYYY') || ' al ' ||
        to_char(NEW.week_end, 'DD/MM/YYYY'),
      '/dashboard/payroll?payroll=' || NEW.id::TEXT
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notifications_tresbe_payroll_sent ON public.tresbe_payrolls;
CREATE TRIGGER notifications_tresbe_payroll_sent
  AFTER UPDATE OF status ON public.tresbe_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.notify_tresbe_payroll_sent();

ALTER TABLE public.tresbe_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage Tresbe employees" ON public.tresbe_employees;
CREATE POLICY "Admins manage Tresbe employees" ON public.tresbe_employees
  FOR ALL TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id))
  WITH CHECK (public.is_admin() AND public.is_tresbe_company(company_id));

DROP POLICY IF EXISTS "Admins manage Tresbe payrolls" ON public.tresbe_payrolls;
CREATE POLICY "Admins manage Tresbe payrolls" ON public.tresbe_payrolls
  FOR ALL TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id))
  WITH CHECK (public.is_admin() AND public.is_tresbe_company(company_id));
DROP POLICY IF EXISTS "Tresbe clients read sent payrolls" ON public.tresbe_payrolls;
CREATE POLICY "Tresbe clients read sent payrolls" ON public.tresbe_payrolls
  FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND company_id = public.current_company_id()
    AND public.is_tresbe_company(company_id)
    AND status IN ('sent', 'viewed', 'corrected')
  );

DROP POLICY IF EXISTS "Admins manage Tresbe payroll entries" ON public.tresbe_payroll_entries;
CREATE POLICY "Admins manage Tresbe payroll entries" ON public.tresbe_payroll_entries
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id AND public.is_admin()
       AND public.is_tresbe_company(p.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id AND public.is_admin()
       AND public.is_tresbe_company(p.company_id)
  ));
DROP POLICY IF EXISTS "Tresbe clients read sent payroll entries" ON public.tresbe_payroll_entries;
CREATE POLICY "Tresbe clients read sent payroll entries" ON public.tresbe_payroll_entries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id
       AND p.company_id = public.current_company_id()
       AND public.is_tresbe_company(p.company_id)
       AND p.status IN ('sent', 'viewed', 'corrected')
  ));

DROP POLICY IF EXISTS "Admins read Tresbe payroll events" ON public.tresbe_payroll_events;
CREATE POLICY "Admins read Tresbe payroll events" ON public.tresbe_payroll_events
  FOR SELECT TO authenticated
  USING (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id AND public.is_tresbe_company(p.company_id)
  ));
DROP POLICY IF EXISTS "Admins create Tresbe payroll events" ON public.tresbe_payroll_events;
CREATE POLICY "Admins create Tresbe payroll events" ON public.tresbe_payroll_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id AND public.is_tresbe_company(p.company_id)
  ));

DROP POLICY IF EXISTS "Admins manage Tresbe payroll settings" ON public.tresbe_payroll_settings;
CREATE POLICY "Admins manage Tresbe payroll settings" ON public.tresbe_payroll_settings
  FOR ALL TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id))
  WITH CHECK (public.is_admin() AND public.is_tresbe_company(company_id));

REVOKE DELETE ON public.tresbe_employees FROM authenticated;
REVOKE DELETE ON public.tresbe_payroll_entries FROM authenticated;
REVOKE ALL ON FUNCTION public.recalculate_tresbe_payroll(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_tresbe_payroll(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_tresbe_payroll(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_tresbe_payroll_viewed(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_tresbe_payroll(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_tresbe_payroll(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_tresbe_payroll(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_tresbe_payroll_viewed(UUID) TO authenticated;
