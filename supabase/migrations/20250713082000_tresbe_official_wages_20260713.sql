-- Official Tresbe Employee List Report dated 2026-07-13.
-- Updates only unambiguous Tresbe matches and preserves closed payroll snapshots.

ALTER TABLE public.tresbe_employees
  ADD COLUMN IF NOT EXISTS annual_salary NUMERIC(14,2) CHECK (
    annual_salary IS NULL OR annual_salary >= 0
  ),
  ADD COLUMN IF NOT EXISTS wage_requires_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wage_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS wage_source TEXT,
  ADD COLUMN IF NOT EXISTS wage_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.tresbe_employee_wage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  previous_hourly_wage NUMERIC(12,2),
  new_hourly_wage NUMERIC(12,2),
  previous_annual_salary NUMERIC(14,2),
  new_annual_salary NUMERIC(14,2),
  previous_weekly_salary NUMERIC(12,2),
  new_weekly_salary NUMERIC(12,2),
  previous_compensation_type TEXT NOT NULL,
  new_compensation_type TEXT NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  update_actor TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tresbe_wage_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  review_key TEXT NOT NULL,
  official_name TEXT,
  source_name TEXT,
  employee_id UUID REFERENCES public.tresbe_employees(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, report_date, review_key)
);

CREATE INDEX IF NOT EXISTS tresbe_wage_events_employee_created_idx
  ON public.tresbe_employee_wage_events(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tresbe_wage_review_open_idx
  ON public.tresbe_wage_review_items(company_id, report_date, created_at)
  WHERE resolved_at IS NULL;

DROP TRIGGER IF EXISTS tresbe_wage_review_updated_at
  ON public.tresbe_wage_review_items;
CREATE TRIGGER tresbe_wage_review_updated_at
  BEFORE UPDATE ON public.tresbe_wage_review_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_tresbe_employee_wage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT := COALESCE(
    NULLIF(current_setting('app.tresbe_wage_source', true), ''),
    'Manual administrator update'
  );
BEGIN
  IF OLD.regular_hourly_rate IS NOT DISTINCT FROM NEW.regular_hourly_rate
     AND OLD.annual_salary IS NOT DISTINCT FROM NEW.annual_salary
     AND OLD.default_weekly_salary IS NOT DISTINCT FROM NEW.default_weekly_salary
     AND OLD.payroll_rule IS NOT DISTINCT FROM NEW.payroll_rule
     AND OLD.payment_method IS NOT DISTINCT FROM NEW.payment_method THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tresbe_employee_wage_events (
    company_id, employee_id, previous_hourly_wage, new_hourly_wage,
    previous_annual_salary, new_annual_salary,
    previous_weekly_salary, new_weekly_salary,
    previous_compensation_type, new_compensation_type,
    updated_by, update_actor, source
  ) VALUES (
    NEW.company_id, NEW.id, OLD.regular_hourly_rate, NEW.regular_hourly_rate,
    OLD.annual_salary, NEW.annual_salary,
    OLD.default_weekly_salary, NEW.default_weekly_salary,
    OLD.payroll_rule::TEXT, NEW.payroll_rule::TEXT,
    auth.uid(), COALESCE(auth.uid()::TEXT, current_user), v_source
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_employee_wage_audit ON public.tresbe_employees;
CREATE TRIGGER tresbe_employee_wage_audit
  AFTER UPDATE OF regular_hourly_rate, annual_salary, default_weekly_salary,
    payroll_rule, payment_method
  ON public.tresbe_employees
  FOR EACH ROW EXECUTE FUNCTION public.audit_tresbe_employee_wage_change();

ALTER TABLE public.tresbe_employee_wage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_wage_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read Tresbe wage events"
  ON public.tresbe_employee_wage_events;
CREATE POLICY "Admins read Tresbe wage events"
  ON public.tresbe_employee_wage_events FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id));

DROP POLICY IF EXISTS "Admins manage Tresbe wage reviews"
  ON public.tresbe_wage_review_items;
CREATE POLICY "Admins manage Tresbe wage reviews"
  ON public.tresbe_wage_review_items FOR ALL TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id))
  WITH CHECK (public.is_admin() AND public.is_tresbe_company(company_id));

REVOKE INSERT, UPDATE, DELETE ON public.tresbe_employee_wage_events
  FROM authenticated;

DROP TABLE IF EXISTS pg_temp.tresbe_official_wages_20260713;
CREATE TEMP TABLE tresbe_official_wages_20260713 (
  official_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  source_name TEXT NOT NULL,
  compensation_type TEXT NOT NULL CHECK (
    compensation_type IN ('hourly', 'salaried')
  ),
  hourly_wage NUMERIC(12,2),
  annual_salary NUMERIC(14,2),
  weekly_salary NUMERIC(12,2)
) ON COMMIT DROP;

INSERT INTO tresbe_official_wages_20260713 VALUES
  ('doel a. acosta', 'Doel A. Acosta', 'ACOSTA, DOEL A.', 'hourly', 15.00, NULL, NULL),
  ('bryan algarin', 'Bryan Algarin', 'ALGARIN, BRYAN', 'hourly', 13.00, NULL, NULL),
  ('fernando almonte', 'Fernando Almonte', 'ALMONTE, FERNANDO', 'hourly', 16.25, NULL, NULL),
  ('joel brauer cardin', 'Joel Brauer Cardin', 'BRAUER CARDIN, JOEL', 'hourly', 25.00, NULL, NULL),
  ('adalberto j. cuadrado', 'Adalberto J. Cuadrado', 'CUADRADO, ADALBERTO J.', 'hourly', 13.50, NULL, NULL),
  ('lee j. de jesus sanchez', 'Lee J. de Jesus Sanchez', 'DE JESUS SANCHEZ, LEE J.', 'hourly', 11.00, NULL, NULL),
  ('joshua fontanez', 'Joshua Fontanez', 'FONTANEZ, JOSHUA', 'hourly', 14.00, NULL, NULL),
  ('oscar fortuno', 'Oscar Fortuno', 'FORTUNO, OSCAR', 'hourly', 9.00, NULL, NULL),
  ('paola c. franco negron', 'Paola C. Franco Negron', 'Franco Negron, Paola C.', 'hourly', 6.00, NULL, NULL),
  ('lee zephyrus p. irene', 'Lee Zephyrus P. Irene', 'IRENE, LEE ZEPHYRINUS P.', 'hourly', 13.00, NULL, NULL),
  ('marc a. lopez', 'Marc A. Lopez', 'LOPEZ, MARC A.', 'hourly', 6.50, NULL, NULL),
  ('alondra martinez', 'Alondra Martinez', 'MARTINEZ, ALONDRA', 'hourly', 13.50, NULL, NULL),
  ('krystal m. nieves', 'Krystal M. Nieves', 'NIEVES, KRYSTAL M.', 'hourly', 5.00, NULL, NULL),
  ('sheila ortiz', 'Sheila Ortiz', 'ORTIZ, SHEILA', 'hourly', 11.50, NULL, NULL),
  ('erwin pabon', 'Erwin Pabon', 'PABON, ERWIN', 'hourly', 14.00, NULL, NULL),
  ('jezaiah l. perez silvestre', 'Jezaiah L. Perez Silvestre', 'Perez Silvestre, Jezaiah L.', 'hourly', 6.00, NULL, NULL),
  ('tamara perez', 'Tamara Perez', 'PEREZ, TAMARA', 'hourly', 9.00, NULL, NULL),
  ('regino pizarro', 'Regino Pizarro', 'PIZARRO, REGINO', 'hourly', 13.00, NULL, NULL),
  ('alanies rivera alomar', 'Alanies Rivera Alomar', 'Rivera Alomar, Alanies', 'hourly', 9.00, NULL, NULL),
  ('jared rivera rodriguez', 'Jared Rivera Rodriguez', 'RIVERA RODRIGUEZ, JARED', 'hourly', 10.50, NULL, NULL),
  ('yohamid rodriguez', 'Yohamid Rodriguez', 'RODRIGUEZ, YOHAMID', 'hourly', 4.50, NULL, NULL),
  ('leslie a. ruiz santiago', 'Leslie A. Ruiz Santiago', 'Ruiz Santiago, Leslie A', 'hourly', 5.00, NULL, NULL),
  ('gustavo g. samot', 'Gustavo G. Samot', 'SAMOT, GUSTAVO G.', 'hourly', 4.75, NULL, NULL),
  ('shaddai sanchez', 'Shaddai Sanchez', 'SANCHEZ, SHADDAI', 'hourly', 9.50, NULL, NULL),
  ('rocio del mar sevilla ortiz', 'Rocio del Mar Sevilla Ortiz', 'SEVILLA ORTIZ, ROCIO DEL MAR', 'hourly', 9.50, NULL, NULL),
  ('alejandro velez', 'Alejandro Velez', 'VELEZ, ALEJANDRO', 'hourly', 12.00, NULL, NULL),
  ('alberto l. chaves', 'Alberto L. Chaves', 'Chaves, Alberto L.', 'salaried', NULL, 32500.00, 625.00),
  ('mario ormaza mercado', 'Mario Ormaza Mercado', 'ORMAZA MERCADO, MARIO', 'salaried', NULL, 40000.00, 769.23);

DO $$
DECLARE
  v_total INTEGER;
  v_hourly INTEGER;
  v_salaried INTEGER;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE compensation_type = 'hourly'),
         count(*) FILTER (WHERE compensation_type = 'salaried')
    INTO v_total, v_hourly, v_salaried
  FROM tresbe_official_wages_20260713;
  IF v_total <> 28 OR v_hourly <> 26 OR v_salaried <> 2 THEN
    RAISE EXCEPTION 'Official Tresbe wage report validation failed';
  END IF;
END;
$$;

DROP TABLE IF EXISTS pg_temp.tresbe_wage_matches_20260713;
CREATE TEMP TABLE tresbe_wage_matches_20260713 ON COMMIT DROP AS
WITH candidates AS (
  SELECT DISTINCT
    report.official_key,
    employee.id AS employee_id
  FROM tresbe_official_wages_20260713 report
  JOIN public.tresbe_employees employee
    ON employee.is_active
   AND public.is_tresbe_company(employee.company_id)
   AND (
     employee.normalized_name = report.official_key
     OR lower(regexp_replace(trim(COALESCE(employee.source_name, '')), '\s+', ' ', 'g')) =
        lower(regexp_replace(trim(report.source_name), '\s+', ' ', 'g'))
   )
), counted AS (
  SELECT
    official_key,
    employee_id,
    count(*) OVER (PARTITION BY official_key) AS official_match_count,
    count(*) OVER (PARTITION BY employee_id) AS employee_report_count
  FROM candidates
)
SELECT * FROM counted;

SELECT set_config(
  'app.tresbe_wage_source',
  'Tresbe Employee List Report — 2026-07-13',
  true
);

UPDATE public.tresbe_employees employee
SET regular_hourly_rate = report.hourly_wage,
    service_hourly_rate = CASE
      WHEN report.official_key = 'leslie a. ruiz santiago'
        THEN report.hourly_wage
      ELSE employee.service_hourly_rate
    END,
    annual_salary = CASE
      WHEN report.compensation_type = 'salaried' THEN report.annual_salary
      ELSE NULL
    END,
    default_weekly_salary = CASE
      WHEN report.compensation_type = 'salaried' THEN report.weekly_salary
      ELSE NULL
    END,
    payroll_rule = CASE
      WHEN report.official_key = 'leslie a. ruiz santiago'
        THEN 'full_services'::public.tresbe_payroll_rule
      WHEN report.compensation_type = 'salaried'
        THEN 'fixed_weekly_salary'::public.tresbe_payroll_rule
      ELSE 'standard_hourly_40_plus_services'::public.tresbe_payroll_rule
    END,
    payment_method = CASE
      WHEN report.official_key = 'leslie a. ruiz santiago'
        THEN 'services'
      WHEN report.compensation_type = 'salaried' THEN 'payroll_system'
      ELSE 'mixed'
    END,
    wage_requires_review = false,
    wage_review_reason = NULL,
    wage_source = 'Tresbe Employee List Report — 2026-07-13',
    wage_updated_at = now()
FROM tresbe_wage_matches_20260713 match
JOIN tresbe_official_wages_20260713 report
  ON report.official_key = match.official_key
WHERE employee.id = match.employee_id
  AND match.official_match_count = 1
  AND match.employee_report_count = 1;

UPDATE public.tresbe_employees employee
SET wage_requires_review = true,
    wage_review_reason = 'Not present in official July 13, 2026 employee report'
WHERE employee.is_active
  AND public.is_tresbe_company(employee.company_id)
  AND NOT EXISTS (
    SELECT 1
    FROM tresbe_wage_matches_20260713 match
    WHERE match.employee_id = employee.id
      AND match.official_match_count = 1
      AND match.employee_report_count = 1
  );

INSERT INTO public.tresbe_wage_review_items (
  company_id, report_date, review_key, official_name, source_name, reason
)
SELECT
  company.id,
  DATE '2026-07-13',
  'official:' || report.official_key,
  report.display_name,
  report.source_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM tresbe_wage_matches_20260713 match
      WHERE match.official_key = report.official_key
    ) THEN 'Ambiguous employee match'
    ELSE 'Official report employee not found in active Tresbe directory'
  END
FROM tresbe_official_wages_20260713 report
CROSS JOIN LATERAL (
  SELECT id FROM public.companies WHERE slug = 'tresbe' LIMIT 1
) company
WHERE NOT EXISTS (
  SELECT 1
  FROM tresbe_wage_matches_20260713 match
  WHERE match.official_key = report.official_key
    AND match.official_match_count = 1
    AND match.employee_report_count = 1
)
ON CONFLICT (company_id, report_date, review_key) DO UPDATE
SET official_name = EXCLUDED.official_name,
    source_name = EXCLUDED.source_name,
    reason = EXCLUDED.reason,
    resolved_at = NULL,
    resolved_by = NULL;

INSERT INTO public.tresbe_wage_review_items (
  company_id, report_date, review_key, employee_id, reason
)
SELECT
  employee.company_id,
  DATE '2026-07-13',
  'active:' || employee.id::TEXT,
  employee.id,
  'Not present in official July 13, 2026 employee report'
FROM public.tresbe_employees employee
WHERE employee.is_active
  AND public.is_tresbe_company(employee.company_id)
  AND employee.wage_requires_review
ON CONFLICT (company_id, report_date, review_key) DO UPDATE
SET employee_id = EXCLUDED.employee_id,
    reason = EXCLUDED.reason,
    resolved_at = NULL,
    resolved_by = NULL;

UPDATE public.tresbe_payrolls payroll
SET employee_count = totals.employee_count,
    total_weekly_hours = totals.total_weekly_hours,
    total_system_hours = totals.total_system_hours,
    total_service_hours = totals.total_service_hours,
    total_system_pay = totals.total_system_pay,
    total_tips = totals.total_tips,
    total_service_checks = totals.total_service_checks,
    total_adjustments = totals.total_adjustments,
    grand_total = totals.grand_total
FROM (
  SELECT
    entry.payroll_id,
    count(*)::INTEGER AS employee_count,
    round(COALESCE(sum(entry.total_weekly_hours), 0), 2) AS total_weekly_hours,
    round(COALESCE(sum(entry.system_hours), 0), 2) AS total_system_hours,
    round(COALESCE(sum(entry.service_hours), 0), 2) AS total_service_hours,
    round(COALESCE(sum(entry.system_pay), 0), 2) AS total_system_pay,
    round(COALESCE(sum(entry.tips), 0), 2) AS total_tips,
    round(COALESCE(sum(entry.service_check_amount), 0), 2) AS total_service_checks,
    round(COALESCE(sum(entry.other_adjustments), 0), 2) AS total_adjustments,
    round(COALESCE(sum(entry.employee_total), 0), 2) AS grand_total
  FROM public.tresbe_payroll_entries entry
  GROUP BY entry.payroll_id
) totals
WHERE payroll.id = totals.payroll_id
  AND payroll.status IN ('draft', 'calculated', 'corrected')
  AND public.is_tresbe_company(payroll.company_id);
