-- Sinexia OS — Client portal structure sprint
-- Idempotent: safe to re-run.
--
-- Why this migration is required:
-- 1. `needs_info` status — UI must distinguish "Falta información" from "Rechazado".
-- 2. `documents.file_size` / `documents.updated_at` — list file size and track status changes.
-- 3. `notifications` table — persistent in-app notifications for clients and admins
--    (localStorage alone cannot notify admins of uploads or clients of status changes).
-- 4. Client DELETE RLS + storage DELETE — allow clients to remove their own documents
--    only while status is still `received`.

-- ---------------------------------------------------------------------------
-- 1. Extend document_status with needs_info
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'document_status'
      AND e.enumlabel = 'needs_info'
  ) THEN
    ALTER TYPE public.document_status ADD VALUE 'needs_info';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Document columns: file_size, updated_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_set_updated_at ON public.documents;
CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_documents_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Notifications table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  company_id   UUID REFERENCES public.companies (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  href         TEXT,
  document_id  UUID REFERENCES public.documents (id) ON DELETE SET NULL,
  report_id    UUID REFERENCES public.reports (id) ON DELETE SET NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_kind_check CHECK (
    kind IN (
      'document_uploaded',
      'document_status_changed',
      'document_needs_info',
      'report_published'
    )
  )
);

CREATE INDEX IF NOT EXISTS notifications_recipient_id_idx
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON public.notifications (recipient_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_company_id_idx
  ON public.notifications (company_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Inserts are performed by SECURITY DEFINER triggers only.
DROP POLICY IF EXISTS "No direct notification inserts" ON public.notifications;

-- ---------------------------------------------------------------------------
-- 4. Notification helper + triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_kind TEXT,
  p_title TEXT,
  p_body TEXT,
  p_href TEXT,
  p_company_id UUID,
  p_document_id UUID DEFAULT NULL,
  p_report_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    recipient_id, company_id, kind, title, body, href, document_id, report_id
  )
  SELECT
    p.id,
    p_company_id,
    p_kind,
    p_title,
    p_body,
    p_href,
    p_document_id,
    p_report_id
  FROM public.profiles p
  WHERE p.role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_company_clients(
  p_company_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_body TEXT,
  p_href TEXT,
  p_document_id UUID DEFAULT NULL,
  p_report_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    recipient_id, company_id, kind, title, body, href, document_id, report_id
  )
  SELECT
    p.id,
    p_company_id,
    p_kind,
    p_title,
    p_body,
    p_href,
    p_document_id,
    p_report_id
  FROM public.profiles p
  WHERE p.role = 'client'
    AND p.company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_document_inserted_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_name TEXT;
BEGIN
  SELECT name INTO company_name
  FROM public.companies
  WHERE id = NEW.company_id;

  PERFORM public.notify_admins(
    'document_uploaded',
    'Nuevo documento recibido',
    COALESCE(company_name, 'Empresa') || ' · ' || NEW.supplier || ' · Factura ' || NEW.invoice_number,
    '/dashboard/inbox?doc=' || NEW.id::TEXT,
    NEW.company_id,
    NEW.id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_notify_insert ON public.documents;
CREATE TRIGGER documents_notify_insert
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.on_document_inserted_notify();

CREATE OR REPLACE FUNCTION public.on_document_status_changed_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_label TEXT;
  kind_value TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  status_label := CASE NEW.status
    WHEN 'received' THEN 'Recibido'
    WHEN 'reviewing' THEN 'En revisión'
    WHEN 'processed' THEN 'Procesado'
    WHEN 'needs_info' THEN 'Falta información'
    WHEN 'rejected' THEN 'Rechazado'
    ELSE NEW.status::TEXT
  END;

  kind_value := CASE
    WHEN NEW.status = 'needs_info' THEN 'document_needs_info'
    ELSE 'document_status_changed'
  END;

  PERFORM public.notify_company_clients(
    NEW.company_id,
    kind_value,
    CASE
      WHEN NEW.status = 'needs_info' THEN 'Falta información en un documento'
      ELSE 'Estado de documento actualizado'
    END,
    NEW.supplier || ' · Factura ' || NEW.invoice_number || ' · ' || status_label,
    '/dashboard/inbox?doc=' || NEW.id::TEXT,
    NEW.id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_notify_status ON public.documents;
CREATE TRIGGER documents_notify_status
  AFTER UPDATE OF status ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.on_document_status_changed_notify();

CREATE OR REPLACE FUNCTION public.on_report_published_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_company_clients(
    NEW.company_id,
    'report_published',
    'Nuevo reporte disponible',
    NEW.title || ' · ' || NEW.period,
    '/dashboard/reports?report=' || NEW.id::TEXT,
    NULL,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_notify_insert ON public.reports;
CREATE TRIGGER reports_notify_insert
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.on_report_published_notify();

-- ---------------------------------------------------------------------------
-- 5. Client delete policies (documents still in received status only)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Clients delete own received documents" ON public.documents;
CREATE POLICY "Clients delete own received documents"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (
    company_id = public.current_company_id()
    AND status = 'received'
  );

DROP POLICY IF EXISTS "Clients delete own company document files" ON storage.objects;
CREATE POLICY "Clients delete own company document files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::TEXT
  );

DROP POLICY IF EXISTS "Admins delete document files" ON storage.objects;
CREATE POLICY "Admins delete document files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_admin()
  );
