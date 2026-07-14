-- Admin-only invoicing with atomic numbering, immutable issued content,
-- private PDF storage, tenant isolation and legacy sequence continuity.

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'draft', 'issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_discount_type AS ENUM ('none', 'fixed', 'percentage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_delivery_status AS ENUM (
    'pending', 'sent', 'failed', 'not_configured'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_frequency AS ENUM (
    'weekly', 'biweekly', 'monthly', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'invoice_issued';

CREATE TABLE IF NOT EXISTS public.billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_key TEXT NOT NULL DEFAULT 'sinexia' UNIQUE,
  issuer_legal_name TEXT,
  issuer_display_name TEXT NOT NULL DEFAULT 'Sinexia',
  logo_storage_path TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  contact_email TEXT,
  phone TEXT,
  payment_method_label TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  routing_number TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD' CHECK (default_currency ~ '^[A-Z]{3}$'),
  default_tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (default_tax_rate BETWEEN 0 AND 100),
  default_footer TEXT,
  signature_storage_path TEXT,
  signature_text TEXT,
  email_sender_name TEXT,
  reply_to_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT
);

INSERT INTO public.billing_settings (settings_key, issuer_display_name)
VALUES ('sinexia', 'Sinexia')
ON CONFLICT (settings_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.company_billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  invoices_enabled BOOLEAN NOT NULL DEFAULT false,
  billing_legal_name TEXT,
  billing_contact_name TEXT,
  billing_email TEXT,
  billing_cc TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  default_payment_terms_days INTEGER NOT NULL DEFAULT 15 CHECK (default_payment_terms_days BETWEEN 0 AND 365),
  default_language TEXT NOT NULL DEFAULT 'es' CHECK (default_language IN ('es', 'en')),
  default_note TEXT,
  default_invoice_items JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(default_invoice_items) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  sequence_key TEXT PRIMARY KEY,
  last_issued_number INTEGER NOT NULL CHECK (last_issued_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.invoice_sequences (sequence_key, last_issued_number)
VALUES ('sinexia_global_invoice', 215)
ON CONFLICT (sequence_key) DO UPDATE
SET last_issued_number = GREATEST(invoice_sequences.last_issued_number, 215);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  invoice_number INTEGER UNIQUE CHECK (invoice_number IS NULL OR invoice_number > 0),
  status public.invoice_status NOT NULL DEFAULT 'draft',
  invoice_date DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_type public.invoice_discount_type NOT NULL DEFAULT 'none',
  discount_value NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  billing_name_snapshot TEXT,
  billing_contact_snapshot TEXT,
  billing_email_snapshot TEXT,
  billing_cc_snapshot TEXT,
  billing_address_snapshot TEXT,
  language TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  purchase_order_reference TEXT,
  client_note TEXT,
  pdf_storage_path TEXT,
  email_status public.invoice_delivery_status,
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payment_reference TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_legacy_import BOOLEAN NOT NULL DEFAULT false,
  legacy_client_label TEXT,
  CHECK (due_date IS NULL OR invoice_date IS NULL OR due_date >= invoice_date),
  CHECK (discount_type <> 'percentage' OR discount_value <= 100),
  CHECK (total = round(subtotal - discount_amount + tax_amount, 2)),
  CHECK ((status = 'draft' AND invoice_number IS NULL) OR status <> 'draft'),
  CHECK (invoice_number IS NULL OR issued_at IS NOT NULL OR is_legacy_import)
);

CREATE INDEX IF NOT EXISTS invoices_company_number_idx
  ON public.invoices(company_id, invoice_number DESC);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx
  ON public.invoices(status, due_date);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  quantity NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 500),
  unit_price NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, position)
);

CREATE TABLE IF NOT EXISTS public.invoice_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  recipient TEXT NOT NULL,
  cc TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  delivery_status public.invoice_delivery_status NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_email_deliveries_invoice_idx
  ON public.invoice_email_deliveries(invoice_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.invoice_admin_details (
  invoice_id UUID PRIMARY KEY REFERENCES public.invoices(id) ON DELETE CASCADE,
  internal_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.recurring_invoice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency public.invoice_frequency NOT NULL,
  weekday SMALLINT CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6),
  next_generation_date DATE,
  default_items JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(default_items) = 'array'),
  default_terms_days INTEGER NOT NULL DEFAULT 15 CHECK (default_terms_days BETWEEN 0 AND 365),
  billing_email TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS recurring_invoice_profiles_due_idx
  ON public.recurring_invoice_profiles(enabled, next_generation_date);

CREATE TABLE IF NOT EXISTS public.invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'draft_created', 'draft_edited', 'number_assigned', 'issued',
    'pdf_generated', 'email_sent', 'email_failed', 'client_viewed',
    'marked_paid', 'cancelled', 'duplicated'
  )),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_events_invoice_idx
  ON public.invoice_events(invoice_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.invoice_views (
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(invoice_id, user_id)
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS notifications_invoice_idx
  ON public.notifications(invoice_id) WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_invoice_item_amount()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.id = NEW.invoice_id AND invoice.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Only draft invoice items may be changed';
  END IF;
  NEW.amount := round(NEW.quantity * NEW.unit_price, 2);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_item_amount_trigger ON public.invoice_items;
CREATE TRIGGER invoice_item_amount_trigger
BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_item_amount();

CREATE OR REPLACE FUNCTION public.protect_invoice_item_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.id = OLD.invoice_id AND invoice.status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'Issued invoice items are immutable';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_invoice_item_delete_trigger ON public.invoice_items;
CREATE TRIGGER protect_invoice_item_delete_trigger
BEFORE DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.protect_invoice_item_delete();

CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(value UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invoice_row public.invoices%ROWTYPE;
  calculated_subtotal NUMERIC(14,2);
  calculated_discount NUMERIC(14,2);
  calculated_tax NUMERIC(14,2);
BEGIN
  SELECT * INTO invoice_row FROM public.invoices WHERE id = value FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice_row.status <> 'draft' THEN RETURN; END IF;

  SELECT round(COALESCE(sum(amount), 0), 2)
  INTO calculated_subtotal
  FROM public.invoice_items WHERE invoice_id = value;

  calculated_discount := CASE invoice_row.discount_type
    WHEN 'fixed' THEN LEAST(calculated_subtotal, round(invoice_row.discount_value, 2))
    WHEN 'percentage' THEN round(calculated_subtotal * invoice_row.discount_value / 100, 2)
    ELSE 0
  END;
  calculated_tax := round(
    GREATEST(calculated_subtotal - calculated_discount, 0) * invoice_row.tax_rate / 100,
    2
  );

  UPDATE public.invoices
  SET subtotal = calculated_subtotal,
      discount_amount = calculated_discount,
      tax_amount = calculated_tax,
      total = round(calculated_subtotal - calculated_discount + calculated_tax, 2),
      updated_at = now()
  WHERE id = value;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_after_item_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recalculate_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recalculate_invoice_items_trigger ON public.invoice_items;
CREATE TRIGGER recalculate_invoice_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.recalculate_invoice_after_item_change();

CREATE OR REPLACE FUNCTION public.recalculate_invoice_after_header_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recalculate_invoice_totals(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_invoice_header_trigger ON public.invoices;
CREATE TRIGGER recalculate_invoice_header_trigger
AFTER UPDATE OF discount_type, discount_value, tax_rate ON public.invoices
FOR EACH ROW WHEN (NEW.status = 'draft')
EXECUTE FUNCTION public.recalculate_invoice_after_header_change();

CREATE OR REPLACE FUNCTION public.protect_issued_invoice_content()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
    NEW.company_id IS DISTINCT FROM OLD.company_id OR
    NEW.invoice_number IS DISTINCT FROM OLD.invoice_number OR
    NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR
    NEW.due_date IS DISTINCT FROM OLD.due_date OR
    NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
    NEW.discount_type IS DISTINCT FROM OLD.discount_type OR
    NEW.discount_value IS DISTINCT FROM OLD.discount_value OR
    NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR
    NEW.tax_rate IS DISTINCT FROM OLD.tax_rate OR
    NEW.tax_amount IS DISTINCT FROM OLD.tax_amount OR
    NEW.total IS DISTINCT FROM OLD.total OR
    NEW.billing_name_snapshot IS DISTINCT FROM OLD.billing_name_snapshot OR
    NEW.billing_contact_snapshot IS DISTINCT FROM OLD.billing_contact_snapshot OR
    NEW.billing_email_snapshot IS DISTINCT FROM OLD.billing_email_snapshot OR
    NEW.billing_cc_snapshot IS DISTINCT FROM OLD.billing_cc_snapshot OR
    NEW.billing_address_snapshot IS DISTINCT FROM OLD.billing_address_snapshot OR
    NEW.language IS DISTINCT FROM OLD.language OR
    NEW.purchase_order_reference IS DISTINCT FROM OLD.purchase_order_reference OR
    NEW.client_note IS DISTINCT FROM OLD.client_note
  ) THEN
    RAISE EXCEPTION 'Issued invoice financial content is immutable';
  END IF;

  IF OLD.pdf_storage_path IS NOT NULL
     AND NEW.pdf_storage_path IS DISTINCT FROM OLD.pdf_storage_path THEN
    RAISE EXCEPTION 'Issued invoice PDF is immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status = 'issued') OR
    (OLD.status = 'issued' AND NEW.status IN ('sent', 'paid', 'overdue', 'cancelled')) OR
    (OLD.status = 'sent' AND NEW.status IN ('viewed', 'paid', 'overdue', 'cancelled')) OR
    (OLD.status = 'viewed' AND NEW.status IN ('paid', 'overdue', 'cancelled')) OR
    (OLD.status = 'overdue' AND NEW.status IN ('paid', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid invoice status transition';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_issued_invoice_content_trigger ON public.invoices;
CREATE TRIGGER protect_issued_invoice_content_trigger
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_issued_invoice_content();

CREATE OR REPLACE FUNCTION public.protect_issued_invoice_delete()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Issued invoices cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_issued_invoice_delete_trigger ON public.invoices;
CREATE TRIGGER protect_issued_invoice_delete_trigger
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_issued_invoice_delete();

CREATE OR REPLACE FUNCTION public.issue_invoice(p_invoice_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invoice_row public.invoices%ROWTYPE;
  assigned_number INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can issue invoices';
  END IF;
  SELECT * INTO invoice_row FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR invoice_row.status <> 'draft' OR invoice_row.is_legacy_import THEN
    RAISE EXCEPTION 'Only a non-legacy draft can be issued';
  END IF;
  IF invoice_row.invoice_date IS NULL OR invoice_row.due_date IS NULL
     OR invoice_row.due_date < invoice_row.invoice_date
     OR invoice_row.billing_name_snapshot IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.invoice_items WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'Invoice is missing required issuance data';
  END IF;
  PERFORM public.recalculate_invoice_totals(p_invoice_id);
  UPDATE public.invoice_sequences
  SET last_issued_number = last_issued_number + 1, updated_at = now()
  WHERE sequence_key = 'sinexia_global_invoice'
  RETURNING last_issued_number INTO assigned_number;
  IF assigned_number IS NULL THEN RAISE EXCEPTION 'Invoice sequence is not configured'; END IF;

  UPDATE public.invoices
  SET invoice_number = assigned_number,
      status = 'issued',
      issued_at = now(),
      issued_by = auth.uid(),
      updated_by = auth.uid()
  WHERE id = p_invoice_id;

  INSERT INTO public.invoice_events(invoice_id, user_id, event_type, details)
  VALUES
    (p_invoice_id, auth.uid(), 'number_assigned', jsonb_build_object('invoice_number', assigned_number)),
    (p_invoice_id, auth.uid(), 'issued', jsonb_build_object('invoice_number', assigned_number));
  RETURN assigned_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_invoice_viewed(p_invoice_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invoice_row public.invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN; END IF;
  SELECT * INTO invoice_row FROM public.invoices
  WHERE id = p_invoice_id
    AND company_id = public.current_company_id()
    AND NOT is_legacy_import
    AND EXISTS (
      SELECT 1 FROM public.company_billing_profiles profile
      WHERE profile.company_id = invoices.company_id
        AND profile.invoices_enabled
    )
    AND status IN ('issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not accessible'; END IF;
  INSERT INTO public.invoice_views(invoice_id, user_id)
  VALUES (p_invoice_id, auth.uid())
  ON CONFLICT (invoice_id, user_id) DO UPDATE SET viewed_at = now();
  IF invoice_row.status = 'sent' THEN
    UPDATE public.invoices SET status = 'viewed', viewed_at = COALESCE(viewed_at, now())
    WHERE id = p_invoice_id;
  ELSE
    UPDATE public.invoices SET viewed_at = COALESCE(viewed_at, now())
    WHERE id = p_invoice_id;
  END IF;
  INSERT INTO public.notification_reads(notification_id, user_id)
  SELECT id, auth.uid() FROM public.notifications WHERE invoice_id = p_invoice_id
  ON CONFLICT (notification_id, user_id) DO UPDATE SET read_at = now();
  INSERT INTO public.invoice_events(invoice_id, user_id, event_type)
  VALUES (p_invoice_id, auth.uid(), 'client_viewed');
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_invoice_overdue_statuses()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  UPDATE public.invoices SET status = 'overdue'
  WHERE status IN ('issued', 'sent', 'viewed')
    AND due_date < CURRENT_DATE
    AND (public.is_admin() OR company_id = public.current_company_id());
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_invoice(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalculate_invoice_totals(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_invoice_after_item_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_invoice_after_header_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_invoice_viewed(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_invoice_overdue_statuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_viewed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_invoice_overdue_statuses() TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_invoice_issued()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'issued' THEN
    INSERT INTO public.notifications(
      dedupe_key, audience, kind, company_id, invoice_id, title, description, href
    ) SELECT
      'invoice-issued:' || NEW.id::TEXT, 'client', 'invoice_issued', NEW.company_id,
      NEW.id, 'Nueva factura disponible',
      'La factura #' || NEW.invoice_number::TEXT || ' está disponible.',
      '/dashboard/invoices?invoiceId=' || NEW.id::TEXT
    WHERE EXISTS (
      SELECT 1 FROM public.company_billing_profiles profile
      WHERE profile.company_id = NEW.company_id
        AND profile.invoices_enabled
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_invoice_issued_trigger ON public.invoices;
CREATE TRIGGER notify_invoice_issued_trigger
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_issued();

CREATE OR REPLACE FUNCTION public.validate_notification_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.report_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.reports r WHERE r.id=NEW.report_id AND r.company_id=NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match report'; END IF;
  IF NEW.document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.id=NEW.document_id AND d.company_id=NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match document'; END IF;
  IF NEW.calendar_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.calendar_items c WHERE c.id=NEW.calendar_item_id AND c.company_id IS NOT DISTINCT FROM NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match calendar item'; END IF;
  IF NEW.invoice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=NEW.invoice_id AND i.company_id=NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match invoice'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notifications_company_integrity ON public.notifications;
CREATE TRIGGER notifications_company_integrity
BEFORE INSERT OR UPDATE OF company_id,report_id,document_id,calendar_item_id,invoice_id
ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.validate_notification_company();

CREATE OR REPLACE FUNCTION public.can_access_notification(value UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.notifications n WHERE n.id=value AND (
    (public.is_admin() AND n.audience='admin' AND (n.target_user_id IS NULL OR n.target_user_id=auth.uid())) OR
    (NOT public.is_admin() AND n.audience='client' AND n.company_id=public.current_company_id())
  ));
$$;

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_admin_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage billing settings" ON public.billing_settings;
CREATE POLICY "Admins manage billing settings" ON public.billing_settings
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage company billing profiles" ON public.company_billing_profiles;
CREATE POLICY "Admins manage company billing profiles" ON public.company_billing_profiles
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Clients read own billing profile" ON public.company_billing_profiles;
CREATE POLICY "Clients read own billing profile" ON public.company_billing_profiles
FOR SELECT TO authenticated USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Admins read invoice sequence" ON public.invoice_sequences;
CREATE POLICY "Admins read invoice sequence" ON public.invoice_sequences
FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices" ON public.invoices
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Clients read own published invoices" ON public.invoices;
CREATE POLICY "Clients read own published invoices" ON public.invoices
FOR SELECT TO authenticated USING (
  company_id = public.current_company_id()
  AND NOT is_legacy_import
  AND EXISTS (
    SELECT 1 FROM public.company_billing_profiles profile
    WHERE profile.company_id = invoices.company_id
      AND profile.invoices_enabled
  )
  AND status IN ('issued', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')
);

DROP POLICY IF EXISTS "Admins manage invoice items" ON public.invoice_items;
CREATE POLICY "Admins manage invoice items" ON public.invoice_items
FOR ALL TO authenticated
USING (public.is_admin() AND EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=invoice_id))
WITH CHECK (public.is_admin() AND EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=invoice_id));
DROP POLICY IF EXISTS "Clients read own published invoice items" ON public.invoice_items;
CREATE POLICY "Clients read own published invoice items" ON public.invoice_items
FOR SELECT TO authenticated USING (EXISTS(
  SELECT 1 FROM public.invoices i WHERE i.id=invoice_id
    AND i.company_id=public.current_company_id()
    AND NOT i.is_legacy_import
    AND EXISTS (
      SELECT 1 FROM public.company_billing_profiles profile
      WHERE profile.company_id=i.company_id AND profile.invoices_enabled
    )
    AND i.status IN ('issued','sent','viewed','paid','overdue','cancelled')
));

DROP POLICY IF EXISTS "Admins manage invoice deliveries" ON public.invoice_email_deliveries;
CREATE POLICY "Admins manage invoice deliveries" ON public.invoice_email_deliveries
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins manage invoice private details" ON public.invoice_admin_details;
CREATE POLICY "Admins manage invoice private details" ON public.invoice_admin_details
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins manage recurring invoice profiles" ON public.recurring_invoice_profiles;
CREATE POLICY "Admins manage recurring invoice profiles" ON public.recurring_invoice_profiles
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins read invoice events" ON public.invoice_events;
CREATE POLICY "Admins read invoice events" ON public.invoice_events
FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Users read own invoice views" ON public.invoice_views;
CREATE POLICY "Users read own invoice views" ON public.invoice_views
FOR SELECT TO authenticated USING (user_id=auth.uid() AND EXISTS(
  SELECT 1 FROM public.invoices i WHERE i.id=invoice_id
    AND (public.is_admin() OR i.company_id=public.current_company_id())
));

REVOKE INSERT, UPDATE, DELETE ON public.invoice_sequences FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoice_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoice_views FROM authenticated;

INSERT INTO storage.buckets(id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins manage invoice files" ON storage.objects;
CREATE POLICY "Admins manage invoice files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id='invoices' AND public.is_admin())
WITH CHECK (bucket_id='invoices' AND public.is_admin());

-- Legacy placeholders preserve the confirmed sequence without inventing dates.
WITH legacy(number, slug, label) AS (
  VALUES
    (212, 'tresbe', 'Tresbe'),
    (213, 'sibarita', 'Sibarita'),
    (214, 'cut-meat-distributors', 'Cut Meat Distributors'),
    (215, 'cut', 'Cut Butcher Shop')
)
INSERT INTO public.invoices(
  company_id, invoice_number, status, currency, billing_name_snapshot,
  is_legacy_import, legacy_client_label
)
SELECT company.id, legacy.number, 'issued', 'USD', legacy.label,
       true, legacy.label
FROM legacy JOIN public.companies company ON company.slug=legacy.slug
ON CONFLICT (invoice_number) DO NOTHING;

DO $$
DECLARE legacy_count INTEGER;
BEGIN
  SELECT count(*) INTO legacy_count FROM public.invoices
  WHERE invoice_number BETWEEN 212 AND 215 AND is_legacy_import;
  IF legacy_count <> 4 THEN
    RAISE EXCEPTION 'Expected four legacy invoice placeholders, found %', legacy_count;
  END IF;
  IF (SELECT last_issued_number FROM public.invoice_sequences
      WHERE sequence_key='sinexia_global_invoice') < 215 THEN
    RAISE EXCEPTION 'Invoice sequence initialization failed';
  END IF;
END;
$$;
