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

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('audit.invoice_client_id'), true);

DO $$
DECLARE other_invoice UUID;
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
END;
$$;
ROLLBACK;
