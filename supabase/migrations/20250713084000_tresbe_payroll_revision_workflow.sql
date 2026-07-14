-- Audited Tresbe workflow for restarting pre-send payrolls and reopening sent
-- payrolls for correction. Existing closed history is never deleted.

ALTER TABLE public.tresbe_payroll_events
  DROP CONSTRAINT IF EXISTS tresbe_payroll_events_event_type_check;
ALTER TABLE public.tresbe_payroll_events
  ADD CONSTRAINT tresbe_payroll_events_event_type_check CHECK (event_type IN (
    'draft_created', 'employee_added', 'recalculated', 'pdf_generated',
    'sent_to_client', 'email_sent', 'email_failed', 'client_viewed',
    'payroll_cancelled', 'service_override', 'draft_reset', 'payroll_reopened'
  ));

CREATE TABLE IF NOT EXISTS public.tresbe_payroll_revision_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES public.tresbe_payrolls(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  reopened_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  previous_status public.tresbe_payroll_status NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) BETWEEN 10 AND 500),
  payroll_snapshot JSONB NOT NULL,
  entries_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (previous_status IN ('sent', 'viewed', 'corrected'))
);

CREATE INDEX IF NOT EXISTS tresbe_payroll_revision_snapshots_payroll_idx
  ON public.tresbe_payroll_revision_snapshots(payroll_id, created_at DESC);

ALTER TABLE public.tresbe_payroll_revision_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read Tresbe payroll revision snapshots"
  ON public.tresbe_payroll_revision_snapshots;
CREATE POLICY "Admins read Tresbe payroll revision snapshots"
  ON public.tresbe_payroll_revision_snapshots
  FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_tresbe_company(company_id));

REVOKE INSERT, UPDATE, DELETE
  ON public.tresbe_payroll_revision_snapshots
  FROM anon, authenticated;
GRANT SELECT ON public.tresbe_payroll_revision_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_tresbe_payroll_status_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
       (OLD.status IN ('sent', 'viewed')
         AND NEW.status IN ('draft', 'calculated', 'corrected'))
       OR (OLD.status IN ('corrected', 'cancelled')
         AND NEW.status IN ('draft', 'calculated'))
     )
     AND (
       NOT public.is_admin()
       OR current_setting('app.tresbe_payroll_revision_id', true)
            IS DISTINCT FROM OLD.id::TEXT
     ) THEN
    RAISE EXCEPTION 'Tresbe payroll can only be reopened through the audited workflow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tresbe_payroll_status_regression
  ON public.tresbe_payrolls;
CREATE TRIGGER tresbe_payroll_status_regression
  BEFORE UPDATE OF status ON public.tresbe_payrolls
  FOR EACH ROW EXECUTE FUNCTION public.protect_tresbe_payroll_status_regression();

CREATE OR REPLACE FUNCTION public.reset_tresbe_payroll_draft(
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
  v_actor UUID := auth.uid();
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can restart Tresbe payroll';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Restart reason must contain between 5 and 500 characters';
  END IF;

  SELECT * INTO v_payroll
  FROM public.tresbe_payrolls
  WHERE id = p_payroll_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_tresbe_company(v_payroll.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll not found';
  END IF;
  IF v_payroll.status NOT IN ('draft', 'calculated', 'cancelled') THEN
    RAISE EXCEPTION 'Only payrolls that have not been sent can be restarted';
  END IF;

  PERFORM set_config(
    'app.tresbe_payroll_revision_id',
    v_payroll.id::TEXT,
    true
  );

  UPDATE public.tresbe_payrolls
  SET status = 'draft',
      employee_count = 0,
      total_weekly_hours = 0,
      total_system_hours = 0,
      total_service_hours = 0,
      total_system_pay = 0,
      total_tips = 0,
      total_service_checks = 0,
      total_adjustments = 0,
      grand_total = 0,
      admin_note = NULL,
      client_note = NULL,
      supporting_document_id = NULL,
      pdf_storage_path = NULL,
      sent_by = NULL,
      sent_at = NULL,
      viewed_at = NULL,
      email_recipient = NULL,
      email_status = NULL,
      email_sent_at = NULL,
      email_sent_by = NULL,
      email_provider_message_id = NULL,
      email_error = NULL,
      updated_by = v_actor
  WHERE id = v_payroll.id;

  DELETE FROM public.tresbe_payroll_entries
  WHERE payroll_id = v_payroll.id;

  INSERT INTO public.tresbe_payroll_entries (
    payroll_id, employee_id, employee_name_snapshot, area_snapshot,
    payment_method_snapshot, payroll_rule_snapshot,
    receives_proportional_tips_snapshot, regular_rate_snapshot,
    service_rate_snapshot, weekly_salary_snapshot, total_weekly_hours
  )
  SELECT
    v_payroll.id, employee.id, employee.display_name, employee.area,
    employee.payment_method, employee.payroll_rule,
    employee.receives_proportional_tips, employee.regular_hourly_rate,
    employee.service_hourly_rate, employee.default_weekly_salary,
    CASE
      WHEN employee.payroll_rule = 'preset_40_weekly_salary' THEN 40
      ELSE COALESCE(employee.default_weekly_hours, 0)
    END
  FROM public.tresbe_employees employee
  WHERE employee.company_id = v_payroll.company_id
    AND employee.is_active;

  UPDATE public.tresbe_payrolls
  SET employee_count = (
    SELECT count(*)::INTEGER
    FROM public.tresbe_payroll_entries
    WHERE payroll_id = v_payroll.id
  )
  WHERE id = v_payroll.id;

  INSERT INTO public.tresbe_payroll_events(
    payroll_id, user_id, event_type, content
  ) VALUES (
    v_payroll.id,
    v_actor,
    'draft_reset',
    v_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_tresbe_payroll(
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
  v_actor UUID := auth.uid();
  v_reason TEXT := trim(COALESCE(p_reason, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reopen Tresbe payroll';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Reopen reason must contain between 10 and 500 characters';
  END IF;

  SELECT * INTO v_payroll
  FROM public.tresbe_payrolls
  WHERE id = p_payroll_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_tresbe_company(v_payroll.company_id) THEN
    RAISE EXCEPTION 'Tresbe payroll not found';
  END IF;
  IF v_payroll.status NOT IN ('sent', 'viewed', 'corrected') THEN
    RAISE EXCEPTION 'Only sent Tresbe payrolls can be reopened';
  END IF;

  INSERT INTO public.tresbe_payroll_revision_snapshots (
    payroll_id, company_id, reopened_by, previous_status, reason,
    payroll_snapshot, entries_snapshot
  ) VALUES (
    v_payroll.id,
    v_payroll.company_id,
    v_actor,
    v_payroll.status,
    v_reason,
    to_jsonb(v_payroll),
    (
      SELECT COALESCE(
        jsonb_agg(to_jsonb(entry) ORDER BY entry.employee_name_snapshot),
        '[]'::JSONB
      )
      FROM public.tresbe_payroll_entries entry
      WHERE entry.payroll_id = v_payroll.id
    )
  );

  INSERT INTO public.tresbe_payroll_events(
    payroll_id, user_id, event_type, content
  ) VALUES (
    v_payroll.id,
    v_actor,
    'payroll_reopened',
    'Estado anterior: ' || v_payroll.status::TEXT || '. Motivo: ' || v_reason
  );

  PERFORM set_config(
    'app.tresbe_payroll_revision_id',
    v_payroll.id::TEXT,
    true
  );

  UPDATE public.tresbe_payrolls
  SET status = 'draft',
      pdf_storage_path = NULL,
      sent_by = NULL,
      sent_at = NULL,
      viewed_at = NULL,
      email_status = NULL,
      email_sent_at = NULL,
      email_sent_by = NULL,
      email_provider_message_id = NULL,
      email_error = NULL,
      updated_by = v_actor
  WHERE id = v_payroll.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_tresbe_payroll_draft(UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_tresbe_payroll(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_tresbe_payroll_draft(UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_tresbe_payroll(UUID, TEXT)
  TO authenticated;

-- Carlos Ramos is confirmed Full Service at $17.50/hour. Never create or map
-- a different employee implicitly; update only the confirmed existing record.
UPDATE public.tresbe_employees employee
SET payroll_rule = 'full_services',
    payment_method = 'services',
    regular_hourly_rate = 17.50,
    service_hourly_rate = 17.50,
    default_weekly_salary = NULL,
    wage_requires_review = false,
    wage_review_reason = NULL,
    wage_source = 'Confirmed Full Service wage — 2026-07-13',
    wage_updated_at = now()
WHERE public.is_tresbe_company(employee.company_id)
  AND employee.normalized_name = 'carlos ramos';
