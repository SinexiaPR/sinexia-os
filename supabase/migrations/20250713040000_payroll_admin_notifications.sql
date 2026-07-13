-- Notify administrators when a weekly payroll is submitted.
-- Idempotent and includes a safe backfill for already-submitted payrolls.

CREATE OR REPLACE FUNCTION public.notify_weekly_payroll_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name TEXT;
BEGIN
  IF NEW.status = 'submitted'
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT name
      INTO v_company_name
      FROM public.companies
     WHERE id = NEW.company_id;

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
      'weekly_payroll_submitted:' || NEW.id::TEXT,
      'admin',
      'weekly_payroll_submitted',
      NEW.company_id,
      'Nómina semanal enviada',
      COALESCE(v_company_name, 'Empresa') || ' · Semana ' ||
        to_char(NEW.week_start, 'DD/MM/YYYY') || ' al ' ||
        to_char(NEW.week_end, 'DD/MM/YYYY'),
      '/dashboard/payroll?company=' || NEW.company_id::TEXT
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_weekly_payroll_submitted
  ON public.weekly_payrolls;
CREATE TRIGGER notifications_weekly_payroll_submitted
  AFTER UPDATE OF status ON public.weekly_payrolls
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_weekly_payroll_submitted();

-- Backfill submitted payrolls that predate the trigger. The unique dedupe key
-- makes this safe to run repeatedly without creating duplicate notifications.
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
  'weekly_payroll_submitted:' || payroll.id::TEXT,
  'admin',
  'weekly_payroll_submitted',
  payroll.company_id,
  'Nómina semanal enviada',
  company.name || ' · Semana ' ||
    to_char(payroll.week_start, 'DD/MM/YYYY') || ' al ' ||
    to_char(payroll.week_end, 'DD/MM/YYYY'),
  '/dashboard/payroll?company=' || payroll.company_id::TEXT
FROM public.weekly_payrolls AS payroll
JOIN public.companies AS company ON company.id = payroll.company_id
WHERE payroll.status = 'submitted'
ON CONFLICT (dedupe_key) DO NOTHING;
