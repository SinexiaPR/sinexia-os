-- Simplify client document intake while preserving existing document rows.
-- Idempotent. Does not change authentication, RLS, reports, or intelligence tables.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'routine',
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS document_type_description TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_priority_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_priority_check
      CHECK (priority IN ('routine', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_comment_length_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_comment_length_check
      CHECK (comment IS NULL OR char_length(comment) <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_type_description_length_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_type_description_length_check
      CHECK (
        document_type_description IS NULL
        OR char_length(document_type_description) <= 120
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_admin_priority_created_idx
  ON public.documents (priority DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_document_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name TEXT;
  v_label TEXT;
  v_upload_title TEXT;
BEGIN
  SELECT name INTO v_company_name FROM public.companies WHERE id = NEW.company_id;
  v_label := NEW.document_type ||
    COALESCE(' · ' || NULLIF(NEW.document_type_description, ''), '');
  v_upload_title := CASE
    WHEN NEW.priority = 'urgent' THEN 'Urgent document received.'
    ELSE 'New document received.'
  END;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_portal_notification(
      'doc_received:' || NEW.id::TEXT,
      'client',
      'document_received',
      NEW.company_id,
      NULL,
      NEW.id,
      v_upload_title,
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
      v_upload_title,
      v_label || COALESCE(' · ' || v_company_name, ''),
      '/dashboard/inbox'
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'reviewing' THEN
      PERFORM public.emit_portal_notification(
        'doc_reviewing:' || NEW.id::TEXT, 'client', 'document_reviewing',
        NEW.company_id, NULL, NEW.id, 'Documento en revisión', v_label,
        '/dashboard/inbox'
      );
      PERFORM public.emit_portal_notification(
        'admin_doc_review:' || NEW.id::TEXT, 'admin', 'requires_review',
        NEW.company_id, NULL, NEW.id, 'Documento requiere revisión',
        v_label || COALESCE(' · ' || v_company_name, ''), '/dashboard/inbox'
      );
    ELSIF NEW.status = 'processed' THEN
      PERFORM public.emit_portal_notification(
        'doc_processed:' || NEW.id::TEXT, 'client', 'document_processed',
        NEW.company_id, NULL, NEW.id, 'Documento procesado', v_label,
        '/dashboard/inbox'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.emit_portal_notification(
        'doc_missing_info:' || NEW.id::TEXT, 'client', 'document_missing_info',
        NEW.company_id, NULL, NEW.id, 'Falta información',
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
