-- SinexIA Document Intelligence v1
-- Idempotent migration.
--
-- Why required:
-- 1. document_processing — track AI extraction/classification status per report
-- 2. document_chunks + pgvector — semantic retrieval scoped by company
-- 3. sinexia_conversations / sinexia_messages — persistent company-scoped chat
--
-- Original reports/documents tables and storage paths are unchanged.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.document_processing_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'requires_ocr'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.detected_document_type AS ENUM (
    'payroll',
    'accounts_receivable',
    'accounts_payable',
    'custom_aging',
    'bank_reconciliation',
    'statement',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- document_processing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_processing (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id              UUID REFERENCES public.reports (id) ON DELETE CASCADE,
  document_id            UUID REFERENCES public.documents (id) ON DELETE CASCADE,
  company_id             UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  status                 public.document_processing_status NOT NULL DEFAULT 'pending',
  detected_document_type public.detected_document_type,
  detected_period        TEXT,
  extracted_text         TEXT,
  structured_summary     JSONB,
  processing_error       TEXT,
  file_format            TEXT,
  is_analyzable          BOOLEAN NOT NULL DEFAULT false,
  model_name             TEXT,
  prompt_version         TEXT,
  token_usage            JSONB,
  processed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_processing_source_check CHECK (
    (report_id IS NOT NULL AND document_id IS NULL)
    OR (report_id IS NULL AND document_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS document_processing_report_id_uidx
  ON public.document_processing (report_id)
  WHERE report_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_processing_document_id_uidx
  ON public.document_processing (document_id)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_processing_company_id_idx
  ON public.document_processing (company_id);

CREATE INDEX IF NOT EXISTS document_processing_status_idx
  ON public.document_processing (status);

CREATE OR REPLACE FUNCTION public.set_document_processing_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_processing_set_updated_at ON public.document_processing;
CREATE TRIGGER document_processing_set_updated_at
  BEFORE UPDATE ON public.document_processing
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_processing_updated_at();

-- ---------------------------------------------------------------------------
-- document_chunks (embeddings: text-embedding-3-small = 1536 dims)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_processing_id UUID NOT NULL REFERENCES public.document_processing (id) ON DELETE CASCADE,
  company_id             UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  content                TEXT NOT NULL,
  page_number            INTEGER,
  sheet_name             TEXT,
  row_reference          TEXT,
  chunk_index            INTEGER NOT NULL DEFAULT 0,
  embedding              vector(1536),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_processing_id_idx
  ON public.document_chunks (document_processing_id);

CREATE INDEX IF NOT EXISTS document_chunks_company_id_idx
  ON public.document_chunks (company_id);

-- IVFFlat requires data; use HNSW when available, else skip until data exists.
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON public.document_chunks
    USING hnsw (embedding vector_cosine_ops);
EXCEPTION
  WHEN undefined_object THEN
    -- Older pgvector without HNSW: fall back to ivfflat after data exists.
    NULL;
  WHEN others THEN
    NULL;
END $$;

-- ---------------------------------------------------------------------------
-- sinexia_conversations / sinexia_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sinexia_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sinexia_conversations_company_id_idx
  ON public.sinexia_conversations (company_id);

CREATE INDEX IF NOT EXISTS sinexia_conversations_user_id_idx
  ON public.sinexia_conversations (user_id);

CREATE OR REPLACE FUNCTION public.set_sinexia_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sinexia_conversations_set_updated_at ON public.sinexia_conversations;
CREATE TRIGGER sinexia_conversations_set_updated_at
  BEFORE UPDATE ON public.sinexia_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sinexia_conversations_updated_at();

CREATE TABLE IF NOT EXISTS public.sinexia_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES public.sinexia_conversations (id) ON DELETE CASCADE,
  company_id         UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  role               TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content            TEXT NOT NULL,
  source_references  JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sinexia_messages_conversation_id_idx
  ON public.sinexia_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS sinexia_messages_company_id_idx
  ON public.sinexia_messages (company_id);

-- ---------------------------------------------------------------------------
-- Similarity search helper (company-scoped)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_company_id UUID,
  match_count INTEGER DEFAULT 8,
  filter_processing_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_processing_id UUID,
  company_id UUID,
  content TEXT,
  page_number INTEGER,
  sheet_name TEXT,
  row_reference TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_processing_id,
    c.company_id,
    c.content,
    c.page_number,
    c.sheet_name,
    c.row_reference,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks c
  INNER JOIN public.document_processing p ON p.id = c.document_processing_id
  WHERE c.company_id = match_company_id
    AND p.status = 'completed'
    AND c.embedding IS NOT NULL
    AND (filter_processing_id IS NULL OR c.document_processing_id = filter_processing_id)
    AND (
      public.is_admin()
      OR c.company_id = public.current_company_id()
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.match_document_chunks(vector, UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, UUID, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, UUID, INTEGER, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.document_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinexia_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinexia_messages ENABLE ROW LEVEL SECURITY;

-- document_processing
DROP POLICY IF EXISTS "Admins read all document processing" ON public.document_processing;
CREATE POLICY "Admins read all document processing"
  ON public.document_processing FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company document processing" ON public.document_processing;
CREATE POLICY "Clients read own company document processing"
  ON public.document_processing FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Admins update document processing" ON public.document_processing;
CREATE POLICY "Admins update document processing"
  ON public.document_processing FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Inserts/updates for processing jobs use service role (bypasses RLS).
-- No direct client INSERT on processing/chunks.

-- document_chunks
DROP POLICY IF EXISTS "Admins read all document chunks" ON public.document_chunks;
CREATE POLICY "Admins read all document chunks"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company document chunks" ON public.document_chunks;
CREATE POLICY "Clients read own company document chunks"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- conversations
DROP POLICY IF EXISTS "Admins read all sinexia conversations" ON public.sinexia_conversations;
CREATE POLICY "Admins read all sinexia conversations"
  ON public.sinexia_conversations FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company sinexia conversations" ON public.sinexia_conversations;
CREATE POLICY "Clients read own company sinexia conversations"
  ON public.sinexia_conversations FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Clients insert own sinexia conversations" ON public.sinexia_conversations;
CREATE POLICY "Clients insert own sinexia conversations"
  ON public.sinexia_conversations FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Clients update own sinexia conversations" ON public.sinexia_conversations;
CREATE POLICY "Clients update own sinexia conversations"
  ON public.sinexia_conversations FOR UPDATE TO authenticated
  USING (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = public.current_company_id()
    AND user_id = auth.uid()
  );

-- messages
DROP POLICY IF EXISTS "Admins read all sinexia messages" ON public.sinexia_messages;
CREATE POLICY "Admins read all sinexia messages"
  ON public.sinexia_messages FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company sinexia messages" ON public.sinexia_messages;
CREATE POLICY "Clients read own company sinexia messages"
  ON public.sinexia_messages FOR SELECT TO authenticated
  USING (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.sinexia_conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
        AND c.company_id = public.current_company_id()
    )
  );

DROP POLICY IF EXISTS "Clients insert own sinexia messages" ON public.sinexia_messages;
CREATE POLICY "Clients insert own sinexia messages"
  ON public.sinexia_messages FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.sinexia_conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
        AND c.company_id = public.current_company_id()
    )
  );
