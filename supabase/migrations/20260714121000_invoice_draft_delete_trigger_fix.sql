-- Allow draft invoices to cascade-delete their items without recalculating a
-- parent invoice that is already being deleted. Normal item edits still
-- recalculate totals through the protected function.

CREATE OR REPLACE FUNCTION public.recalculate_invoice_after_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  target_invoice_id UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.invoices WHERE id = target_invoice_id
  ) THEN
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_invoice_totals(target_invoice_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION public.recalculate_invoice_after_item_change() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.recalculate_invoice_after_item_change()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
