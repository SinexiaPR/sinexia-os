-- Per-user document view tracking (separate from workflow status)
-- Idempotent. Does not alter auth, document processing, or workflow enums.

CREATE TABLE IF NOT EXISTS public.document_views (
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS document_views_user_idx
  ON public.document_views (user_id);

CREATE INDEX IF NOT EXISTS document_views_document_idx
  ON public.document_views (document_id);

ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own document views" ON public.document_views;
CREATE POLICY "Users read own document views"
  ON public.document_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own document views" ON public.document_views;
CREATE POLICY "Users insert own document views"
  ON public.document_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own document views" ON public.document_views;
CREATE POLICY "Users update own document views"
  ON public.document_views FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
