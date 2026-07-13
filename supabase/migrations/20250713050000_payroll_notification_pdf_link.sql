-- Open submitted payroll notifications directly as printable PDFs.
-- Idempotent and preserves the existing tenant-associated notification.

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
      '/api/payroll/' || NEW.id::TEXT || '/pdf'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.notifications AS notification
SET href = '/api/payroll/' || payroll.id::TEXT || '/pdf'
FROM public.weekly_payrolls AS payroll
WHERE notification.dedupe_key =
      'weekly_payroll_submitted:' || payroll.id::TEXT
  AND notification.kind = 'weekly_payroll_submitted'
  AND notification.company_id = payroll.company_id
  AND notification.href IS DISTINCT FROM
      '/api/payroll/' || payroll.id::TEXT || '/pdf';
