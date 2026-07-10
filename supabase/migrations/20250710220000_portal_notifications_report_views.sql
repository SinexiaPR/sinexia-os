-- Portal UX: in-app notifications + per-user report views
-- Idempotent. Does not alter auth, RLS on core tables, or upload flows.

DO $$
BEGIN
  CREATE TYPE public.notification_audience AS ENUM ('client', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.notification_kind AS ENUM (
    'report_published',
    'document_received',
    'document_reviewing',
    'document_missing_info',
    'document_processed',
    'sinexia_analysis_completed',
    'sinexia_analysis_failed',
    'client_document_uploaded',
    'processing_failed',
    'requires_ocr',
    'requires_review'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key    TEXT NOT NULL UNIQUE,
  audience      public.notification_audience NOT NULL,
  kind          public.notification_kind NOT NULL,
  company_id    UUID REFERENCES public.companies (id) ON DELETE CASCADE,
  report_id     UUID REFERENCES public.reports (id) ON DELETE CASCADE,
  document_id   UUID REFERENCES public.documents (id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  href          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_audience_created_idx
  ON public.notifications (audience, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_company_created_idx
  ON public.notifications (company_id, created_at DESC)
  WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id UUID NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_user_idx
  ON public.notification_reads (user_id);

CREATE TABLE IF NOT EXISTS public.report_views (
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  report_id  UUID NOT NULL REFERENCES public.reports (id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, report_id)
);

CREATE INDEX IF NOT EXISTS report_views_user_idx
  ON public.report_views (user_id);

CREATE INDEX IF NOT EXISTS report_views_report_idx
  ON public.report_views (report_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read admin notifications" ON public.notifications;
CREATE POLICY "Admins read admin notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.is_admin() AND audience = 'admin');

DROP POLICY IF EXISTS "Clients read own company notifications" ON public.notifications;
CREATE POLICY "Clients read own company notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    audience = 'client'
    AND company_id = public.current_company_id()
  );

DROP POLICY IF EXISTS "Service role manages notifications" ON public.notifications;
CREATE POLICY "Service role manages notifications"
  ON public.notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users read own notification reads" ON public.notification_reads;
CREATE POLICY "Users read own notification reads"
  ON public.notification_reads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own notification reads" ON public.notification_reads;
CREATE POLICY "Users insert own notification reads"
  ON public.notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own report views" ON public.report_views;
CREATE POLICY "Users read own report views"
  ON public.report_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own report views" ON public.report_views;
CREATE POLICY "Users insert own report views"
  ON public.report_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own report views" ON public.report_views;
CREATE POLICY "Users update own report views"
  ON public.report_views FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Notification emit helper (SECURITY DEFINER for triggers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.emit_portal_notification(
  p_dedupe_key TEXT,
  p_audience public.notification_audience,
  p_kind public.notification_kind,
  p_company_id UUID,
  p_report_id UUID,
  p_document_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_href TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    dedupe_key,
    audience,
    kind,
    company_id,
    report_id,
    document_id,
    title,
    description,
    href
  )
  VALUES (
    p_dedupe_key,
    p_audience,
    p_kind,
    p_company_id,
    p_report_id,
    p_document_id,
    p_title,
    p_description,
    p_href
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- Report published -> client notification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_report_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.emit_portal_notification(
    'report_published:' || NEW.id::TEXT,
    'client',
    'report_published',
    NEW.company_id,
    NEW.id,
    NULL,
    'Nuevo reporte publicado',
    NEW.title || ' · ' || NEW.category,
    '/dashboard/reports?view=' || NEW.id::TEXT
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_report_published ON public.reports;
CREATE TRIGGER notifications_report_published
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_report_published();

-- ---------------------------------------------------------------------------
-- Document upload / status -> client + admin notifications
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_document_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name TEXT;
  v_label TEXT;
BEGIN
  SELECT name INTO v_company_name FROM public.companies WHERE id = NEW.company_id;
  v_label := NEW.supplier || ' · ' || NEW.document_type;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_portal_notification(
      'doc_received:' || NEW.id::TEXT,
      'client',
      'document_received',
      NEW.company_id,
      NULL,
      NEW.id,
      'Documento recibido por Sinexia',
      v_label,
      '/dashboard/inbox'
    );

    PERFORM public.emit_portal_notification(
      'admin_doc_upload:' || NEW.id::TEXT,
      'admin',
      'client_document_uploaded',
      NEW.company_id,
      NULL,
      NEW.id,
      'Nuevo documento enviado',
      v_label || COALESCE(' · ' || v_company_name, ''),
      '/dashboard/inbox'
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'reviewing' THEN
      PERFORM public.emit_portal_notification(
        'doc_reviewing:' || NEW.id::TEXT,
        'client',
        'document_reviewing',
        NEW.company_id,
        NULL,
        NEW.id,
        'Documento en revisión',
        v_label,
        '/dashboard/inbox'
      );

      PERFORM public.emit_portal_notification(
        'admin_doc_review:' || NEW.id::TEXT,
        'admin',
        'requires_review',
        NEW.company_id,
        NULL,
        NEW.id,
        'Documento requiere revisión',
        v_label || COALESCE(' · ' || v_company_name, ''),
        '/dashboard/inbox'
      );
    ELSIF NEW.status = 'processed' THEN
      PERFORM public.emit_portal_notification(
        'doc_processed:' || NEW.id::TEXT,
        'client',
        'document_processed',
        NEW.company_id,
        NULL,
        NEW.id,
        'Documento procesado',
        v_label,
        '/dashboard/inbox'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.emit_portal_notification(
        'doc_missing_info:' || NEW.id::TEXT,
        'client',
        'document_missing_info',
        NEW.company_id,
        NULL,
        NEW.id,
        'Falta información',
        v_label || ' — contacte a Sinexia si necesita ayuda.',
        '/dashboard/inbox'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_document_events ON public.documents;
CREATE TRIGGER notifications_document_events
  AFTER INSERT OR UPDATE OF status ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_document_events();

-- ---------------------------------------------------------------------------
-- SinexIA processing status -> client + admin notifications
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_processing_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_href TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.report_id IS NOT NULL THEN
    v_href := '/dashboard/reports?view=' || NEW.report_id::TEXT;
    SELECT title INTO v_title FROM public.reports WHERE id = NEW.report_id;
  ELSE
    v_href := '/dashboard/inbox';
    SELECT supplier || ' · ' || document_type INTO v_title
    FROM public.documents WHERE id = NEW.document_id;
  END IF;

  v_title := COALESCE(v_title, 'Documento');

  IF NEW.status = 'completed' THEN
    PERFORM public.emit_portal_notification(
      'sinexia_completed:' || NEW.id::TEXT,
      'client',
      'sinexia_analysis_completed',
      NEW.company_id,
      NEW.report_id,
      NEW.document_id,
      'Análisis de SinexIA completado',
      v_title,
      v_href
    );
  ELSIF NEW.status = 'failed' THEN
    PERFORM public.emit_portal_notification(
      'sinexia_failed:' || NEW.id::TEXT,
      'client',
      'sinexia_analysis_failed',
      NEW.company_id,
      NEW.report_id,
      NEW.document_id,
      'Análisis de SinexIA con error',
      COALESCE(NEW.processing_error, v_title),
      v_href
    );

    PERFORM public.emit_portal_notification(
      'admin_processing_failed:' || NEW.id::TEXT,
      'admin',
      'processing_failed',
      NEW.company_id,
      NEW.report_id,
      NEW.document_id,
      'Procesamiento de documento falló',
      COALESCE(NEW.processing_error, v_title),
      CASE
        WHEN NEW.report_id IS NOT NULL THEN '/dashboard/reports'
        ELSE '/dashboard/inbox'
      END
    );
  ELSIF NEW.status = 'requires_ocr' THEN
    PERFORM public.emit_portal_notification(
      'admin_requires_ocr:' || NEW.id::TEXT,
      'admin',
      'requires_ocr',
      NEW.company_id,
      NEW.report_id,
      NEW.document_id,
      'Documento requiere OCR',
      v_title,
      CASE
        WHEN NEW.report_id IS NOT NULL THEN '/dashboard/reports'
        ELSE '/dashboard/inbox'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_processing_events ON public.document_processing;
CREATE TRIGGER notifications_processing_events
  AFTER UPDATE OF status ON public.document_processing
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_processing_events();
