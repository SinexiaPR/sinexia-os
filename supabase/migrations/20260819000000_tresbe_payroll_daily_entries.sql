-- Baseline migration documenting the Tresbe "Carga Diaria" (day-by-day,
-- shift-by-shift) engine: already live in the lrlzqgkfalbuunkixdbd
-- Supabase project, but never checked into this repo's migration history
-- until now. All statements are idempotent so this is safe to run again
-- against the environment where it already exists.
--
-- Model: tresbe_payroll_shift_pools holds one Clover tip pool per
-- (payroll_id, work_date, shift). tresbe_payroll_daily_entries holds one
-- row per (payroll_id, employee_id, work_date, shift) with hours worked
-- and either an individual "Cafe con Ce" tip or a share of the shift's
-- pool. Shift is always a manual AM/PM choice -- never inferred from a
-- clock time, since real shifts routinely cross midday and a fixed cutoff
-- doesn't hold up against real punches.
--
-- Triggers keep the whole chain in sync on plain INSERT/UPDATE/DELETE:
-- a daily entry or pool change recalculates that shift's proportional
-- tip split, which rolls up into the employee's weekly
-- tresbe_payroll_entries row (total_weekly_hours, tips), which the
-- existing calculate_tresbe_payroll_entry trigger turns into pay exactly
-- as it already did for manually-entered weekly totals. No calculation
-- logic lives in the application layer.

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_shift_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.tresbe_payrolls(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  work_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift = ANY (ARRAY['AM'::text, 'PM'::text])),
  tip_pool_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  source TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_id, work_date, shift)
);

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.tresbe_payrolls(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  employee_id UUID NOT NULL REFERENCES public.tresbe_employees(id),
  work_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift = ANY (ARRAY['AM'::text, 'PM'::text])),
  area_snapshot TEXT NOT NULL,
  receives_proportional_tips_snapshot BOOLEAN NOT NULL DEFAULT false,
  hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  tip_cafe_manual NUMERIC(12,2) NOT NULL DEFAULT 0,
  tip_proportional NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_correction BOOLEAN NOT NULL DEFAULT false,
  correction_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_id, employee_id, work_date, shift)
);

DROP TRIGGER IF EXISTS tresbe_payroll_shift_pools_updated_at ON public.tresbe_payroll_shift_pools;
CREATE TRIGGER tresbe_payroll_shift_pools_updated_at
  BEFORE UPDATE ON public.tresbe_payroll_shift_pools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tresbe_payroll_daily_entries_updated_at ON public.tresbe_payroll_daily_entries;
CREATE TRIGGER tresbe_payroll_daily_entries_updated_at
  BEFORE UPDATE ON public.tresbe_payroll_daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reuses protect_tresbe_payroll_entries (already defined for
-- tresbe_payroll_entries): rows are immutable once the payroll's status
-- leaves draft/calculated/corrected.
DROP TRIGGER IF EXISTS tresbe_payroll_shift_pools_immutable ON public.tresbe_payroll_shift_pools;
CREATE TRIGGER tresbe_payroll_shift_pools_immutable
  BEFORE UPDATE OR DELETE ON public.tresbe_payroll_shift_pools
  FOR EACH ROW EXECUTE FUNCTION public.protect_tresbe_payroll_entries();

DROP TRIGGER IF EXISTS tresbe_payroll_daily_entries_immutable ON public.tresbe_payroll_daily_entries;
CREATE TRIGGER tresbe_payroll_daily_entries_immutable
  BEFORE UPDATE OR DELETE ON public.tresbe_payroll_daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_tresbe_payroll_entries();

CREATE OR REPLACE FUNCTION public.validate_tresbe_shift_pool_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = NEW.payroll_id
       AND p.company_id = NEW.company_id
       AND public.is_tresbe_company(p.company_id)
  ) THEN
    RAISE EXCEPTION 'Tresbe payroll shift pool company mismatch';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_shift_pool_company_integrity ON public.tresbe_payroll_shift_pools;
CREATE TRIGGER tresbe_payroll_shift_pool_company_integrity
  BEFORE INSERT OR UPDATE ON public.tresbe_payroll_shift_pools
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_shift_pool_company();

DROP TRIGGER IF EXISTS tresbe_payroll_daily_entry_company_integrity ON public.tresbe_payroll_daily_entries;
CREATE TRIGGER tresbe_payroll_daily_entry_company_integrity
  BEFORE INSERT OR UPDATE ON public.tresbe_payroll_daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_tresbe_payroll_entry_company();

-- Recomputes tip_proportional for every proportional-tip employee in one
-- shift: pool amount split by each person's share of that shift's total
-- proportional-eligible hours. Employees who don't share the pool
-- (receives_proportional_tips_snapshot = false, e.g. Cafe con Ce, who use
-- tip_cafe_manual instead) always get 0 here.
CREATE OR REPLACE FUNCTION public.recalc_tresbe_payroll_shift(
  p_payroll_id UUID, p_work_date DATE, p_shift TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool NUMERIC(12,2);
  v_total_hours NUMERIC(12,2);
BEGIN
  SELECT COALESCE(tip_pool_amount, 0) INTO v_pool
  FROM public.tresbe_payroll_shift_pools
  WHERE payroll_id = p_payroll_id AND work_date = p_work_date AND shift = p_shift;

  SELECT COALESCE(SUM(hours), 0) INTO v_total_hours
  FROM public.tresbe_payroll_daily_entries
  WHERE payroll_id = p_payroll_id AND work_date = p_work_date AND shift = p_shift
    AND receives_proportional_tips_snapshot;

  UPDATE public.tresbe_payroll_daily_entries d
  SET tip_proportional = CASE
        WHEN d.receives_proportional_tips_snapshot AND v_total_hours > 0
          THEN ROUND(d.hours / v_total_hours * COALESCE(v_pool, 0), 2)
        ELSE 0
      END
  WHERE d.payroll_id = p_payroll_id AND d.work_date = p_work_date AND d.shift = p_shift
    AND d.tip_proportional IS DISTINCT FROM (
      CASE WHEN d.receives_proportional_tips_snapshot AND v_total_hours > 0
        THEN ROUND(d.hours / v_total_hours * COALESCE(v_pool, 0), 2)
        ELSE 0
      END
    );
END;
$$;

-- Sums an employee's daily rows across the whole payroll into the weekly
-- tresbe_payroll_entries row that already drives pay via
-- calculate_tresbe_payroll_entry.
CREATE OR REPLACE FUNCTION public.rollup_tresbe_payroll_daily_entries(
  p_payroll_id UUID, p_employee_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours NUMERIC(12,2);
  v_tips NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(hours), 0), COALESCE(SUM(tip_proportional + tip_cafe_manual), 0)
    INTO v_hours, v_tips
  FROM public.tresbe_payroll_daily_entries
  WHERE payroll_id = p_payroll_id AND employee_id = p_employee_id;

  UPDATE public.tresbe_payroll_entries
  SET total_weekly_hours = v_hours,
      tips = v_tips
  WHERE payroll_id = p_payroll_id AND employee_id = p_employee_id
    AND (total_weekly_hours IS DISTINCT FROM v_hours OR tips IS DISTINCT FROM v_tips);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_tresbe_payroll_daily_entry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  PERFORM public.recalc_tresbe_payroll_shift(v_row.payroll_id, v_row.work_date, v_row.shift);
  PERFORM public.rollup_tresbe_payroll_daily_entries(v_row.payroll_id, v_row.employee_id);

  IF TG_OP = 'UPDATE' AND (OLD.work_date IS DISTINCT FROM NEW.work_date OR OLD.shift IS DISTINCT FROM NEW.shift) THEN
    PERFORM public.recalc_tresbe_payroll_shift(OLD.payroll_id, OLD.work_date, OLD.shift);
  END IF;

  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_daily_entries_recalc ON public.tresbe_payroll_daily_entries;
CREATE TRIGGER tresbe_payroll_daily_entries_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.tresbe_payroll_daily_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_tresbe_payroll_daily_entry_change();

CREATE OR REPLACE FUNCTION public.trg_tresbe_shift_pool_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;
  PERFORM public.recalc_tresbe_payroll_shift(v_row.payroll_id, v_row.work_date, v_row.shift);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS tresbe_payroll_shift_pools_recalc ON public.tresbe_payroll_shift_pools;
CREATE TRIGGER tresbe_payroll_shift_pools_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.tresbe_payroll_shift_pools
  FOR EACH ROW EXECUTE FUNCTION public.trg_tresbe_shift_pool_change();

ALTER TABLE public.tresbe_payroll_shift_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tresbe_payroll_daily_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage Tresbe payroll shift pools" ON public.tresbe_payroll_shift_pools;
CREATE POLICY "Admins manage Tresbe payroll shift pools"
  ON public.tresbe_payroll_shift_pools FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tresbe_payrolls p WHERE p.id = payroll_id AND public.is_admin() AND public.is_tresbe_company(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tresbe_payrolls p WHERE p.id = payroll_id AND public.is_admin() AND public.is_tresbe_company(p.company_id)));

DROP POLICY IF EXISTS "Tresbe clients read sent payroll shift pools" ON public.tresbe_payroll_shift_pools;
CREATE POLICY "Tresbe clients read sent payroll shift pools"
  ON public.tresbe_payroll_shift_pools FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id
       AND p.company_id = public.current_company_id()
       AND public.is_tresbe_company(p.company_id)
       AND p.status = ANY (ARRAY['sent'::public.tresbe_payroll_status,'viewed'::public.tresbe_payroll_status,'corrected'::public.tresbe_payroll_status])
  ));

DROP POLICY IF EXISTS "Admins manage Tresbe payroll daily entries" ON public.tresbe_payroll_daily_entries;
CREATE POLICY "Admins manage Tresbe payroll daily entries"
  ON public.tresbe_payroll_daily_entries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tresbe_payrolls p WHERE p.id = payroll_id AND public.is_admin() AND public.is_tresbe_company(p.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tresbe_payrolls p WHERE p.id = payroll_id AND public.is_admin() AND public.is_tresbe_company(p.company_id)));

DROP POLICY IF EXISTS "Tresbe clients read sent payroll daily entries" ON public.tresbe_payroll_daily_entries;
CREATE POLICY "Tresbe clients read sent payroll daily entries"
  ON public.tresbe_payroll_daily_entries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tresbe_payrolls p
     WHERE p.id = payroll_id
       AND p.company_id = public.current_company_id()
       AND public.is_tresbe_company(p.company_id)
       AND p.status = ANY (ARRAY['sent'::public.tresbe_payroll_status,'viewed'::public.tresbe_payroll_status,'corrected'::public.tresbe_payroll_status])
  ));

CREATE INDEX IF NOT EXISTS tresbe_payroll_shift_pools_payroll_idx ON public.tresbe_payroll_shift_pools(payroll_id);
CREATE INDEX IF NOT EXISTS tresbe_payroll_daily_entries_payroll_idx ON public.tresbe_payroll_daily_entries(payroll_id);
CREATE INDEX IF NOT EXISTS tresbe_payroll_daily_entries_employee_idx ON public.tresbe_payroll_daily_entries(payroll_id, employee_id);
