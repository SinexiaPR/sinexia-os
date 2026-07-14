-- Company-scoped invoice visibility, per-client notifications and first-view tracking.
-- The client-visible transition is draft -> issued because issued invoices are already
-- immutable, numbered and available through the client RLS policy.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS invoice_number INTEGER;

CREATE INDEX IF NOT EXISTS notifications_invoice_user_idx
  ON public.notifications(invoice_id, target_user_id)
  WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_invoice_issued()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'issued' THEN
    INSERT INTO public.notifications(
      dedupe_key,
      audience,
      kind,
      company_id,
      invoice_id,
      invoice_number,
      target_user_id,
      title,
      description,
      href
    )
    SELECT
      'invoice-issued:' || NEW.id::TEXT || ':' || profile.id::TEXT,
      'client',
      'invoice_issued',
      NEW.company_id,
      NEW.id,
      NEW.invoice_number,
      profile.id,
      'Nueva factura disponible',
      'Se generó la factura #' || NEW.invoice_number::TEXT || ' por ' ||
        NEW.currency || ' ' || trim(to_char(NEW.total, 'FM999999999990.00')) || '.',
      '/dashboard/invoices?invoiceId=' || NEW.id::TEXT
    FROM public.profiles profile
    WHERE profile.company_id = NEW.company_id
      AND profile.role = 'client'
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_invoice_issued_trigger ON public.invoices;
CREATE TRIGGER notify_invoice_issued_trigger
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_issued();

CREATE OR REPLACE FUNCTION public.mark_invoice_viewed(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_row public.invoices%ROWTYPE;
  inserted_views INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RAISE EXCEPTION 'Only clients can mark invoices viewed';
  END IF;

  SELECT * INTO invoice_row
  FROM public.invoices
  WHERE id = p_invoice_id
    AND company_id = public.current_company_id()
    AND NOT is_legacy_import
    AND status IN ('issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');

  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND profile.role = 'client'
      AND profile.company_id = invoice_row.company_id
  ) THEN
    RAISE EXCEPTION 'Invoice not accessible';
  END IF;

  INSERT INTO public.invoice_views(invoice_id, user_id)
  VALUES (p_invoice_id, auth.uid())
  ON CONFLICT (invoice_id, user_id) DO NOTHING;
  GET DIAGNOSTICS inserted_views = ROW_COUNT;

  UPDATE public.invoices
  SET viewed_at = COALESCE(viewed_at, now())
  WHERE id = p_invoice_id;

  INSERT INTO public.notification_reads(notification_id, user_id, read_at)
  SELECT notification.id, auth.uid(), now()
  FROM public.notifications notification
  WHERE notification.invoice_id = p_invoice_id
    AND notification.company_id = invoice_row.company_id
    AND notification.audience = 'client'
    AND notification.kind = 'invoice_issued'
    AND (
      notification.target_user_id IS NULL
      OR notification.target_user_id = auth.uid()
    )
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  IF inserted_views > 0 THEN
    INSERT INTO public.invoice_events(invoice_id, user_id, event_type)
    VALUES (p_invoice_id, auth.uid(), 'client_viewed');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_invoice_viewed(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_invoice_viewed(UUID) TO authenticated;

DROP POLICY IF EXISTS "Clients read own published invoices" ON public.invoices;
CREATE POLICY "Clients read own published invoices" ON public.invoices
FOR SELECT TO authenticated USING (
  company_id = public.current_company_id()
  AND NOT is_legacy_import
  AND status IN ('issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')
);

DROP POLICY IF EXISTS "Clients read own published invoice items" ON public.invoice_items;
CREATE POLICY "Clients read own published invoice items" ON public.invoice_items
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.invoices invoice
    WHERE invoice.id = invoice_id
      AND invoice.company_id = public.current_company_id()
      AND NOT invoice.is_legacy_import
      AND invoice.status IN ('issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')
  )
);

DROP POLICY IF EXISTS "Clients read own company notifications" ON public.notifications;
CREATE POLICY "Clients read own company notifications" ON public.notifications
FOR SELECT TO authenticated USING (
  audience = 'client'
  AND company_id = public.current_company_id()
  AND (target_user_id IS NULL OR target_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.can_access_notification(value UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications notification
    WHERE notification.id = value
      AND (
        (
          public.is_admin()
          AND notification.audience = 'admin'
          AND (
            notification.target_user_id IS NULL
            OR notification.target_user_id = auth.uid()
          )
        )
        OR (
          NOT public.is_admin()
          AND notification.audience = 'client'
          AND notification.company_id = public.current_company_id()
          AND (
            notification.target_user_id IS NULL
            OR notification.target_user_id = auth.uid()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.validate_notification_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.report_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.reports report
    WHERE report.id = NEW.report_id AND report.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'notification company does not match report';
  END IF;
  IF NEW.document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = NEW.document_id AND document.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'notification company does not match document';
  END IF;
  IF NEW.calendar_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.calendar_items item
    WHERE item.id = NEW.calendar_item_id
      AND item.company_id IS NOT DISTINCT FROM NEW.company_id
  ) THEN
    RAISE EXCEPTION 'notification company does not match calendar item';
  END IF;
  IF NEW.invoice_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.id = NEW.invoice_id AND invoice.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'notification company does not match invoice';
  END IF;
  IF NEW.invoice_number IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.id = NEW.invoice_id
      AND invoice.company_id = NEW.company_id
      AND invoice.invoice_number = NEW.invoice_number
  ) THEN
    RAISE EXCEPTION 'notification invoice number does not match invoice';
  END IF;
  IF NEW.kind = 'invoice_issued' AND (
    NEW.target_user_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = NEW.target_user_id
        AND profile.role = 'client'
        AND profile.company_id = NEW.company_id
    )
  ) THEN
    RAISE EXCEPTION 'invoice notification target does not match company client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_company_integrity ON public.notifications;
CREATE TRIGGER notifications_company_integrity
BEFORE INSERT OR UPDATE OF
  company_id,
  report_id,
  document_id,
  calendar_item_id,
  invoice_id,
  invoice_number,
  target_user_id,
  kind
ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.validate_notification_company();

-- Convert shared invoice notifications into one row per current client while
-- preserving each client's existing read state.
INSERT INTO public.notifications(
  dedupe_key,
  audience,
  kind,
  company_id,
  invoice_id,
  invoice_number,
  target_user_id,
  title,
  description,
  href,
  created_at
)
SELECT
  'invoice-issued:' || invoice.id::TEXT || ':' || profile.id::TEXT,
  'client',
  'invoice_issued',
  invoice.company_id,
  invoice.id,
  invoice.invoice_number,
  profile.id,
  'Nueva factura disponible',
  'Se generó la factura #' || invoice.invoice_number::TEXT || ' por ' ||
    invoice.currency || ' ' || trim(to_char(invoice.total, 'FM999999999990.00')) || '.',
  '/dashboard/invoices?invoiceId=' || invoice.id::TEXT,
  COALESCE(shared.created_at, invoice.issued_at, invoice.created_at)
FROM public.invoices invoice
JOIN public.profiles profile
  ON profile.company_id = invoice.company_id
 AND profile.role = 'client'
LEFT JOIN public.notifications shared
  ON shared.invoice_id = invoice.id
 AND shared.kind = 'invoice_issued'
 AND shared.target_user_id IS NULL
WHERE NOT invoice.is_legacy_import
  AND invoice.invoice_number IS NOT NULL
  AND invoice.status IN ('issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.notification_reads(notification_id, user_id, read_at)
SELECT targeted.id, old_read.user_id, old_read.read_at
FROM public.notifications shared
JOIN public.notification_reads old_read
  ON old_read.notification_id = shared.id
JOIN public.notifications targeted
  ON targeted.invoice_id = shared.invoice_id
 AND targeted.kind = 'invoice_issued'
 AND targeted.target_user_id = old_read.user_id
WHERE shared.kind = 'invoice_issued'
  AND shared.target_user_id IS NULL
ON CONFLICT (notification_id, user_id) DO NOTHING;

DELETE FROM public.notifications shared
WHERE shared.kind = 'invoice_issued'
  AND shared.target_user_id IS NULL;
