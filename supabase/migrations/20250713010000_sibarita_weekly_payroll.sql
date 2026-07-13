-- Sibarita weekly payroll master data and immutable historical snapshots.

DO $$ BEGIN CREATE TYPE public.payroll_compensation_type AS ENUM ('hourly','hourly_training','fixed_weekly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.weekly_payroll_status AS ENUM ('draft','submitted','approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.normalize_employee_name(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(translate(lower(trim(value)), 'áéíóúüñàèìòù', 'aeiouunaeiou'), '[^a-z0-9]+', ' ', 'g');
$$;

CREATE TABLE IF NOT EXISTS public.payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL CHECK (char_length(trim(first_name)) BETWEEN 1 AND 80),
  last_name TEXT NOT NULL CHECK (char_length(trim(last_name)) BETWEEN 1 AND 120),
  normalized_name TEXT GENERATED ALWAYS AS (public.normalize_employee_name(first_name || ' ' || last_name)) STORED,
  section TEXT NOT NULL CHECK (section IN ('BOTANICO FOH','SELVA FOH','BOH')),
  compensation_type public.payroll_compensation_type,
  regular_hourly_rate NUMERIC(10,2) CHECK (regular_hourly_rate IS NULL OR regular_hourly_rate >= 0),
  training_hourly_rate NUMERIC(10,2) CHECK (training_hourly_rate IS NULL OR training_hourly_rate >= 0),
  fixed_weekly_salary NUMERIC(12,2) CHECK (fixed_weekly_salary IS NULL OR fixed_weekly_salary >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  requires_compensation_review BOOLEAN NOT NULL DEFAULT false,
  internal_note TEXT CHECK (internal_note IS NULL OR char_length(internal_note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.weekly_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status public.weekly_payroll_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekly_payroll_dates CHECK (week_end = week_start + 6),
  UNIQUE(company_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.weekly_payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.weekly_payrolls(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.payroll_employees(id) ON DELETE RESTRICT,
  employee_name_snapshot TEXT NOT NULL,
  section_snapshot TEXT NOT NULL,
  compensation_type_snapshot public.payroll_compensation_type,
  regular_rate_snapshot NUMERIC(10,2),
  training_rate_snapshot NUMERIC(10,2),
  fixed_salary_snapshot NUMERIC(12,2),
  requires_review_snapshot BOOLEAN NOT NULL DEFAULT false,
  regular_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (regular_hours >= 0),
  training_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (training_hours >= 0),
  other_payments NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (other_payments >= 0),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_id, employee_id)
);

CREATE INDEX IF NOT EXISTS payroll_employees_company_active_idx ON public.payroll_employees(company_id,active);
CREATE INDEX IF NOT EXISTS weekly_payrolls_company_week_idx ON public.weekly_payrolls(company_id,week_start DESC);
CREATE INDEX IF NOT EXISTS weekly_payroll_entries_payroll_idx ON public.weekly_payroll_entries(payroll_id);

DROP TRIGGER IF EXISTS payroll_employees_updated_at ON public.payroll_employees;
CREATE TRIGGER payroll_employees_updated_at BEFORE UPDATE ON public.payroll_employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS weekly_payrolls_updated_at ON public.weekly_payrolls;
CREATE TRIGGER weekly_payrolls_updated_at BEFORE UPDATE ON public.weekly_payrolls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS weekly_payroll_entries_updated_at ON public.weekly_payroll_entries;
CREATE TRIGGER weekly_payroll_entries_updated_at BEFORE UPDATE ON public.weekly_payroll_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_sibarita_company(value UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id=value AND slug='sibarita');
$$;

CREATE OR REPLACE FUNCTION public.add_active_employees_to_payroll()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_sibarita_company(NEW.company_id) THEN RAISE EXCEPTION 'Weekly payroll is only enabled for Sibarita'; END IF;
  INSERT INTO public.weekly_payroll_entries(payroll_id,employee_id,employee_name_snapshot,section_snapshot,compensation_type_snapshot,regular_rate_snapshot,training_rate_snapshot,fixed_salary_snapshot,requires_review_snapshot)
  SELECT NEW.id,e.id,trim(e.first_name||' '||e.last_name),e.section,e.compensation_type,e.regular_hourly_rate,e.training_hourly_rate,e.fixed_weekly_salary,e.requires_compensation_review
  FROM public.payroll_employees e WHERE e.company_id=NEW.company_id AND e.active
  ON CONFLICT(payroll_id,employee_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS weekly_payroll_load_employees ON public.weekly_payrolls;
CREATE TRIGGER weekly_payroll_load_employees AFTER INSERT ON public.weekly_payrolls FOR EACH ROW EXECUTE FUNCTION public.add_active_employees_to_payroll();

CREATE OR REPLACE FUNCTION public.sync_employee_to_draft_payrolls()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.active AND NOT OLD.active) THEN
    INSERT INTO public.weekly_payroll_entries(payroll_id,employee_id,employee_name_snapshot,section_snapshot,compensation_type_snapshot,regular_rate_snapshot,training_rate_snapshot,fixed_salary_snapshot,requires_review_snapshot)
    SELECT p.id,NEW.id,trim(NEW.first_name||' '||NEW.last_name),NEW.section,NEW.compensation_type,NEW.regular_hourly_rate,NEW.training_hourly_rate,NEW.fixed_weekly_salary,NEW.requires_compensation_review
    FROM public.weekly_payrolls p WHERE p.company_id=NEW.company_id AND p.status='draft'
    ON CONFLICT(payroll_id,employee_id) DO NOTHING;
  END IF;
  IF TG_OP='UPDATE' THEN
    UPDATE public.weekly_payroll_entries pe SET employee_name_snapshot=trim(NEW.first_name||' '||NEW.last_name),section_snapshot=NEW.section,compensation_type_snapshot=NEW.compensation_type,regular_rate_snapshot=NEW.regular_hourly_rate,training_rate_snapshot=NEW.training_hourly_rate,fixed_salary_snapshot=NEW.fixed_weekly_salary,requires_review_snapshot=NEW.requires_compensation_review
    FROM public.weekly_payrolls p WHERE pe.payroll_id=p.id AND pe.employee_id=NEW.id AND p.status='draft';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS payroll_employee_sync_drafts ON public.payroll_employees;
CREATE TRIGGER payroll_employee_sync_drafts AFTER INSERT OR UPDATE ON public.payroll_employees FOR EACH ROW EXECUTE FUNCTION public.sync_employee_to_draft_payrolls();

CREATE OR REPLACE FUNCTION public.protect_submitted_payroll_entries()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.weekly_payrolls WHERE id=COALESCE(NEW.payroll_id,OLD.payroll_id) AND status<>'draft') THEN RAISE EXCEPTION 'Submitted payroll entries are immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
DROP TRIGGER IF EXISTS weekly_payroll_entries_immutable ON public.weekly_payroll_entries;
CREATE TRIGGER weekly_payroll_entries_immutable BEFORE UPDATE OR DELETE ON public.weekly_payroll_entries FOR EACH ROW EXECUTE FUNCTION public.protect_submitted_payroll_entries();

CREATE OR REPLACE FUNCTION public.validate_weekly_payroll_submission()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    IF OLD.status IN ('submitted','approved') AND NEW.status <> 'approved' THEN RAISE EXCEPTION 'Payroll status cannot move backwards'; END IF;
    IF NEW.status='approved' AND NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can approve payroll'; END IF;
  END IF;
  IF OLD.status='draft' AND NEW.status IN ('submitted','approved') AND EXISTS(
    SELECT 1 FROM public.weekly_payroll_entries e WHERE e.payroll_id=NEW.id AND (
      e.regular_hours<0 OR e.training_hours<0 OR e.other_payments<0 OR
      (e.regular_hours>0 AND (e.compensation_type_snapshot NOT IN ('hourly','hourly_training') OR COALESCE(e.regular_rate_snapshot,0)<=0)) OR
      (e.training_hours>0 AND (e.compensation_type_snapshot<>'hourly_training' OR COALESCE(e.training_rate_snapshot,0)<=0)) OR
      (e.compensation_type_snapshot='fixed_weekly' AND COALESCE(e.fixed_salary_snapshot,0)<=0) OR
      ((e.regular_hours>0 OR e.training_hours>0) AND e.requires_review_snapshot)
    )
  ) THEN RAISE EXCEPTION 'Payroll contains employees with invalid or unreviewed compensation'; END IF;
  IF OLD.status='draft' AND NEW.status='submitted' THEN NEW.submitted_at=now(); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS weekly_payroll_validate_submission ON public.weekly_payrolls;
CREATE TRIGGER weekly_payroll_validate_submission BEFORE UPDATE OF status ON public.weekly_payrolls FOR EACH ROW EXECUTE FUNCTION public.validate_weekly_payroll_submission();

ALTER TABLE public.payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_payroll_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sibarita users read payroll employees" ON public.payroll_employees;
CREATE POLICY "Sibarita users read payroll employees" ON public.payroll_employees FOR SELECT TO authenticated USING (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id()));
DROP POLICY IF EXISTS "Sibarita users manage payroll employees" ON public.payroll_employees;
DROP POLICY IF EXISTS "Sibarita users create payroll employees" ON public.payroll_employees;
CREATE POLICY "Sibarita users create payroll employees" ON public.payroll_employees FOR INSERT TO authenticated WITH CHECK (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id()));
DROP POLICY IF EXISTS "Sibarita users update payroll employees" ON public.payroll_employees;
CREATE POLICY "Sibarita users update payroll employees" ON public.payroll_employees FOR UPDATE TO authenticated USING (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id())) WITH CHECK (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id()));
DROP POLICY IF EXISTS "Sibarita users read weekly payrolls" ON public.weekly_payrolls;
CREATE POLICY "Sibarita users read weekly payrolls" ON public.weekly_payrolls FOR SELECT TO authenticated USING (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id()));
DROP POLICY IF EXISTS "Sibarita users create weekly payrolls" ON public.weekly_payrolls;
CREATE POLICY "Sibarita users create weekly payrolls" ON public.weekly_payrolls FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR company_id=public.current_company_id()) AND public.is_sibarita_company(company_id) AND created_by=auth.uid());
DROP POLICY IF EXISTS "Sibarita users update weekly payrolls" ON public.weekly_payrolls;
CREATE POLICY "Sibarita users update weekly payrolls" ON public.weekly_payrolls FOR UPDATE TO authenticated USING (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id())) WITH CHECK (public.is_sibarita_company(company_id) AND (public.is_admin() OR company_id=public.current_company_id()));
DROP POLICY IF EXISTS "Sibarita users manage payroll entries" ON public.weekly_payroll_entries;
CREATE POLICY "Sibarita users manage payroll entries" ON public.weekly_payroll_entries FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.weekly_payrolls p WHERE p.id=payroll_id AND (public.is_admin() OR (p.company_id=public.current_company_id() AND public.is_sibarita_company(p.company_id))))) WITH CHECK (EXISTS(SELECT 1 FROM public.weekly_payrolls p WHERE p.id=payroll_id AND (public.is_admin() OR (p.company_id=public.current_company_id() AND public.is_sibarita_company(p.company_id)))));

DO $$
DECLARE v_company UUID;
BEGIN
  SELECT id INTO v_company FROM public.companies WHERE slug='sibarita';
  IF v_company IS NULL THEN RAISE NOTICE 'Sibarita company not found; payroll seed skipped'; RETURN; END IF;
  INSERT INTO public.payroll_employees(company_id,first_name,last_name,section,compensation_type,regular_hourly_rate,training_hourly_rate,fixed_weekly_salary,requires_compensation_review,internal_note) VALUES
  (v_company,'Alejandro','Rivera','BOTANICO FOH','hourly',7.50,0,NULL,false,NULL),
  (v_company,'Nimzay','Travieso','BOTANICO FOH','hourly',7.50,0,NULL,false,NULL),
  (v_company,'Victor','Hernandez','BOTANICO FOH','hourly',7.50,0,NULL,false,NULL),
  (v_company,'Mariana','Cobian','BOTANICO FOH','hourly',7.50,0,NULL,false,NULL),
  (v_company,'Carlos Jesus','Hernandez','BOTANICO FOH','hourly_training',7.50,10.50,NULL,false,NULL),
  (v_company,'Stephanie Rose','Garofalo','BOTANICO FOH','hourly_training',7.50,10.50,NULL,false,NULL),
  (v_company,'Edgar','Lizardi','BOTANICO FOH','hourly',11.00,0,NULL,false,NULL),
  (v_company,'Emil','Rosado','SELVA FOH','hourly',7.50,0,NULL,false,NULL),
  (v_company,'Krystal Noely','Diaz','SELVA FOH','hourly',7.50,0,NULL,false,NULL),
  (v_company,'Rikardo','Gonzalez','SELVA FOH',NULL,NULL,NULL,NULL,true,'El archivo fuente indica pago semanal previo de 800.00. Requiere revisión administrativa; no se infirió el tipo de compensación.'),
  (v_company,'Ruth','Molina','SELVA FOH','hourly_training',6.50,10.50,NULL,false,NULL),
  (v_company,'Sherlyan Amor Benitez','Betancourt','SELVA FOH','hourly',13.00,0,NULL,false,NULL),
  (v_company,'Juan C','Berrios Santini','BOH','hourly',NULL,0,NULL,true,'Tarifa ausente en el archivo fuente. Configurar antes de registrar horas.'),
  (v_company,'Valerie','Vicente','BOH','hourly',12.00,0,NULL,false,NULL),
  (v_company,'Daniel','Gonzalez','BOH','hourly',20.00,0,NULL,false,'La nómina semanal anterior contenía un ajuste de pago.'),
  (v_company,'Hector','Ortiz','BOH','hourly',13.00,0,NULL,false,NULL),
  (v_company,'Fernando','Almonte','BOH',NULL,NULL,NULL,NULL,true,'El archivo fuente indica pago semanal previo de 400.00. Requiere revisión administrativa; no se infirió el tipo de compensación.'),
  (v_company,'Gabriel','Windevochel','BOH','hourly',7.50,0,NULL,false,NULL)
  ON CONFLICT(company_id,normalized_name) DO NOTHING;
END $$;
