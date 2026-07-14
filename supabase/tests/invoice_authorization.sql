-- Transactional negative authorization checks. Run after the invoicing migration.
BEGIN;
SELECT set_config('audit.invoice_client_id', id::TEXT, true),
       set_config('audit.invoice_client_company', company_id::TEXT, true)
FROM public.profiles
WHERE role='client' AND company_id IS NOT NULL
ORDER BY email LIMIT 1;

SELECT set_config(
  'audit.other_invoice',
  COALESCE((SELECT id::TEXT FROM public.invoices
    WHERE company_id <> current_setting('audit.invoice_client_company')::UUID
      AND status <> 'draft' LIMIT 1), ''),
  true
);

SELECT set_config(
  'audit.other_invoice_notification',
  COALESCE((SELECT notification.id::TEXT
    FROM public.notifications notification
    JOIN public.invoices invoice ON invoice.id = notification.invoice_id
    WHERE invoice.company_id = current_setting('audit.invoice_client_company')::UUID
      AND notification.kind = 'invoice_issued'
      AND notification.target_user_id IS NOT NULL
      AND notification.target_user_id <> current_setting('audit.invoice_client_id')::UUID
    LIMIT 1), ''),
  true
);

SELECT set_config(
  'audit.invoice_count',
  (SELECT count(*)::TEXT FROM public.invoices),
  true
);

SELECT set_config(
  'audit.invoice_admin_id',
  COALESCE((SELECT id::TEXT FROM public.profiles WHERE role='admin' LIMIT 1), ''),
  true
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('audit.invoice_client_id'), true);

DO $$
DECLARE other_invoice UUID;
DECLARE other_notification UUID;
DECLARE allowed BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.invoices(company_id, status)
    VALUES(current_setting('audit.invoice_client_company')::UUID, 'draft');
    allowed := true;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF allowed THEN RAISE EXCEPTION 'RLS failure: client created invoice'; END IF;

  other_invoice := NULLIF(current_setting('audit.other_invoice'), '')::UUID;
  IF other_invoice IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.invoices WHERE id=other_invoice
  ) THEN
    RAISE EXCEPTION 'RLS failure: client read another company invoice';
  END IF;

  BEGIN
    PERFORM public.issue_invoice(other_invoice);
    allowed := true;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF allowed THEN RAISE EXCEPTION 'Authorization failure: client issued invoice'; END IF;

  BEGIN
    PERFORM public.mark_invoice_viewed(other_invoice);
    allowed := true;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF allowed THEN
    RAISE EXCEPTION 'Authorization failure: client could mark another company invoice viewed';
  END IF;

  other_notification := NULLIF(current_setting('audit.other_invoice_notification'), '')::UUID;
  IF other_notification IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.notifications WHERE id=other_notification
  ) THEN
    RAISE EXCEPTION 'RLS failure: client could read another user''s invoice notification';
  END IF;
  IF other_notification IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notification_reads(notification_id, user_id)
      VALUES(other_notification, current_setting('audit.invoice_client_id')::UUID);
      allowed := true;
    EXCEPTION WHEN OTHERS THEN allowed := false;
    END;
    IF allowed THEN
      RAISE EXCEPTION 'RLS failure: client could mark another user''s invoice notification read';
    END IF;
  END IF;
END;
$$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('audit.invoice_admin_id'), true);

DO $$
BEGIN
  IF NULLIF(current_setting('audit.invoice_admin_id'), '') IS NOT NULL
     AND current_setting('audit.invoice_count')::INTEGER > 0
     AND NOT EXISTS (SELECT 1 FROM public.invoices) THEN
    RAISE EXCEPTION 'Authorization failure: admin cannot read invoices';
  END IF;
END;
$$;
ROLLBACK;
