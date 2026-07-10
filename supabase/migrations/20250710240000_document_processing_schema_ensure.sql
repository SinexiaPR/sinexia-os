-- Ensure document_processing columns used by the upload/processing pipeline exist.
-- Idempotent. Service-role inserts bypass RLS; authenticated admin insert policy
-- remains optional for diagnostics only.

ALTER TABLE public.document_processing
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;
