-- Create one admin notification for each payroll submission attempt.
-- The submission timestamp keeps retries idempotent while allowing a payroll
-- that was reopened and corrected to notify administrators again.

CREATE OR REPLACE FUNCTION public.notify_weekly_payroll_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name TEXT;
  v_submission_key TEXT;
BEGIN
  IF NEW.status = 'submitted'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT name
      INTO v_company_name
      FROM public.companies
     WHERE id = NEW.company_id;

    v_submission_key :=
      'weekly_payroll_submitted:' || NEW.id::TEXT || ':' ||
      to_char(
        COALESCE(NEW.submitted_at, NEW.updated_at, now()) AT TIME ZONE 'UTC',
        'YYYYMMDDHH24MISSUS'
      );

    INSERT INTO public.notifications (
      dedupe_key,
      audience,
      kind,
      company_id,
      title,
      description,
      href
    )
    VALUES (
      v_submission_key,
      'admin',
      'weekly_payroll_submitted',
      NEW.company_id,
      'Nómina semanal enviada',
      COALESCE(v_company_name, 'Empresa') || ' · Semana ' ||
        to_char(NEW.week_start, 'DD/MM/YYYY') || ' al ' ||
        to_char(NEW.week_end, 'DD/MM/YYYY'),
      '/api/payroll/' || NEW.id::TEXT || '/pdf'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Recover the unread notification for payrolls that were already resubmitted
-- before this migration was installed. The timestamp key makes this backfill
-- safe to run repeatedly.
INSERT INTO public.notifications (
  dedupe_key,
  audience,
  kind,
  company_id,
  title,
  description,
  href
)
SELECT
  'weekly_payroll_submitted:' || payroll.id::TEXT || ':' ||
    to_char(
      COALESCE(payroll.submitted_at, payroll.updated_at, payroll.created_at)
        AT TIME ZONE 'UTC',
      'YYYYMMDDHH24MISSUS'
    ),
  'admin',
  'weekly_payroll_submitted',
  payroll.company_id,
  'Nómina semanal enviada',
  company.name || ' · Semana ' ||
    to_char(payroll.week_start, 'DD/MM/YYYY') || ' al ' ||
    to_char(payroll.week_end, 'DD/MM/YYYY'),
  '/api/payroll/' || payroll.id::TEXT || '/pdf'
FROM public.weekly_payrolls AS payroll
JOIN public.companies AS company ON company.id = payroll.company_id
WHERE payroll.status = 'submitted'
ON CONFLICT (dedupe_key) DO NOTHING;
