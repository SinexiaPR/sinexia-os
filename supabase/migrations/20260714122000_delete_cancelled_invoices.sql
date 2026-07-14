-- Let administrators permanently delete drafts and explicitly cancelled
-- invoices. Official invoice numbers are never reused by the sequence.

CREATE OR REPLACE FUNCTION public.protect_issued_invoice_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status NOT IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Only draft or cancelled invoices can be deleted';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_admin_invoice(p_invoice_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_invoice public.invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete invoices'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO target_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  IF target_invoice.is_legacy_import
     OR target_invoice.status NOT IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Only non-legacy draft or cancelled invoices can be deleted';
  END IF;

  DELETE FROM public.invoice_email_deliveries
  WHERE invoice_id = p_invoice_id;

  DELETE FROM public.invoices
  WHERE id = p_invoice_id;

  RETURN target_invoice.pdf_storage_path;
END;
$$;

ALTER FUNCTION public.protect_issued_invoice_delete() OWNER TO postgres;
ALTER FUNCTION public.delete_admin_invoice(UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.delete_admin_invoice(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_admin_invoice(UUID)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
