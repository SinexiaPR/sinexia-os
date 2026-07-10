-- SinexIA Specialized Extractor v1 — content hash for identical-file skip
-- Idempotent. Does not modify RLS policies beyond additive column.

ALTER TABLE public.document_processing
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS document_processing_content_hash_idx
  ON public.document_processing (company_id, content_hash)
  WHERE content_hash IS NOT NULL;
