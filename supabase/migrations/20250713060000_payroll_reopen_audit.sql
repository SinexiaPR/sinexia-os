-- Allow administrators to reopen submitted payrolls through one audited path.
-- Existing payroll entries are preserved and become editable only after the
-- payroll has safely returned to draft.

CREATE TABLE IF NOT EXISTS public.payroll_reopen_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.weekly_payrolls(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  reopened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_status public.weekly_payroll_status NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 10 AND 500),
  reopened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (previous_status IN ('submitted', 'approved'))
);

CREATE INDEX IF NOT EXISTS payroll_reopen_events_payroll_idx
  ON public.payroll_reopen_events(payroll_id, reopened_at DESC);
CREATE INDEX IF NOT EXISTS payroll_reopen_events_company_idx
  ON public.payroll_reopen_events(company_id, reopened_at DESC);

ALTER TABLE public.payroll_reopen_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read payroll reopen audit" ON public.payroll_reopen_events;
CREATE POLICY "Admins read payroll reopen audit"
  ON public.payroll_reopen_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.payroll_reopen_events
  FROM anon, authenticated;
GRANT SELECT ON public.payroll_reopen_events TO authenticated;

-- Keep ordinary status updates immutable. Only the SECURITY DEFINER function
-- below can set this transaction-local authorization marker.
CREATE OR REPLACE FUNCTION public.validate_weekly_payroll_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    IF OLD.status IN ('submitted', 'approved') AND NEW.status <> 'approved' THEN
      IF NEW.status <> 'draft'
         OR NOT public.is_admin()
         OR current_setting('app.payroll_reopen_payroll_id', true)
              IS DISTINCT FROM OLD.id::TEXT THEN
        RAISE EXCEPTION 'Payroll status cannot move backwards';
      END IF;
    END IF;

    IF NEW.status = 'approved' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can approve payroll';
    END IF;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IN ('submitted', 'approved') AND EXISTS (
    SELECT 1
      FROM public.weekly_payroll_entries e
     WHERE e.payroll_id = NEW.id
       AND (
         e.regular_hours < 0 OR
         e.training_hours < 0 OR
         e.other_payments < 0 OR
         (e.regular_hours > 0 AND (
           e.compensation_type_snapshot NOT IN ('hourly', 'hourly_training') OR
           COALESCE(e.regular_rate_snapshot, 0) <= 0
         )) OR
         (e.training_hours > 0 AND (
           e.compensation_type_snapshot <> 'hourly_training' OR
           COALESCE(e.training_rate_snapshot, 0) <= 0
         )) OR
         (e.compensation_type_snapshot = 'fixed_weekly' AND
           COALESCE(e.fixed_salary_snapshot, 0) <= 0) OR
         ((e.regular_hours > 0 OR e.training_hours > 0) AND
           e.requires_review_snapshot)
       )
  ) THEN
    RAISE EXCEPTION 'Payroll contains employees with invalid or unreviewed compensation';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'submitted' THEN
    NEW.submitted_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_weekly_payroll(
  p_payroll_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payroll public.weekly_payrolls%ROWTYPE;
  v_actor UUID := auth.uid();
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reopen payroll';
  END IF;

  IF char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Reopen reason must contain between 10 and 500 characters';
  END IF;

  SELECT *
    INTO v_payroll
    FROM public.weekly_payrolls
   WHERE id = p_payroll_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll not found';
  END IF;

  IF NOT public.is_sibarita_company(v_payroll.company_id) THEN
    RAISE EXCEPTION 'Weekly payroll is only enabled for Sibarita';
  END IF;

  IF v_payroll.status NOT IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'Only submitted or approved payrolls can be reopened';
  END IF;

  INSERT INTO public.payroll_reopen_events (
    payroll_id,
    company_id,
    reopened_by,
    previous_status,
    reason
  ) VALUES (
    v_payroll.id,
    v_payroll.company_id,
    v_actor,
    v_payroll.status,
    v_reason
  );

  PERFORM set_config(
    'app.payroll_reopen_payroll_id',
    v_payroll.id::TEXT,
    true
  );

  UPDATE public.weekly_payrolls
     SET status = 'draft',
         submitted_at = NULL,
         approved_at = NULL
   WHERE id = v_payroll.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_weekly_payroll(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_weekly_payroll(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reopen_weekly_payroll(UUID, TEXT)
  TO authenticated;
