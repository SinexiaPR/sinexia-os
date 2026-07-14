-- Keep new invoice due dates on the invoice date without rewriting issued history.

ALTER TABLE public.company_billing_profiles
  ALTER COLUMN default_payment_terms_days SET DEFAULT 0;

ALTER TABLE public.recurring_invoice_profiles
  ALTER COLUMN default_terms_days SET DEFAULT 0;

UPDATE public.company_billing_profiles
SET default_payment_terms_days = 0,
    updated_at = now()
WHERE default_payment_terms_days <> 0;

UPDATE public.recurring_invoice_profiles
SET default_terms_days = 0,
    updated_at = now()
WHERE default_terms_days <> 0;

UPDATE public.invoices
SET due_date = invoice_date,
    updated_at = now()
WHERE status = 'draft'
  AND invoice_date IS NOT NULL
  AND due_date IS DISTINCT FROM invoice_date;

CREATE OR REPLACE FUNCTION public.enforce_invoice_same_day_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'draft' AND NEW.invoice_date IS NOT NULL THEN
    NEW.due_date := NEW.invoice_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invoice_same_day_due_date_trigger
  ON public.invoices;
CREATE TRIGGER enforce_invoice_same_day_due_date_trigger
BEFORE INSERT OR UPDATE OF invoice_date, due_date ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_same_day_due_date();

NOTIFY pgrst, 'reload schema';
