-- SinexIA Document Intelligence v1.1 — document-first metadata & types
-- Idempotent. Does not modify RLS policies.

-- ---------------------------------------------------------------------------
-- Extend detected_document_type enum
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'homebase_export';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'quickbooks_report';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'profit_and_loss';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'balance_sheet';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'bank_statement';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'invoice';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.detected_document_type ADD VALUE IF NOT EXISTS 'purchase_order';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Metadata columns for retrieval quality
-- ---------------------------------------------------------------------------

ALTER TABLE public.document_processing
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

CREATE INDEX IF NOT EXISTS document_processing_document_type_idx
  ON public.document_processing (company_id, detected_document_type);

CREATE INDEX IF NOT EXISTS document_processing_report_date_idx
  ON public.document_processing (company_id, report_date);
