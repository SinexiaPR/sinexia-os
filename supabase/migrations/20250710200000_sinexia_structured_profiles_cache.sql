-- SinexIA v3: structured document profiles + GPT response cache
-- Idempotent. Does not alter reports/documents upload flows.

-- ---------------------------------------------------------------------------
-- document_profiles — typed structured JSON per processed document
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_processing_id  UUID NOT NULL UNIQUE
    REFERENCES public.document_processing (id) ON DELETE CASCADE,
  company_id              UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  report_id               UUID REFERENCES public.reports (id) ON DELETE CASCADE,
  document_id             UUID REFERENCES public.documents (id) ON DELETE CASCADE,
  document_type           public.detected_document_type,
  period                  TEXT,
  structured_data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary                 TEXT,
  extraction_confidence   NUMERIC(4, 3),
  source_document         TEXT,
  upload_date             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_profiles_company_id_idx
  ON public.document_profiles (company_id);

CREATE INDEX IF NOT EXISTS document_profiles_report_id_idx
  ON public.document_profiles (report_id)
  WHERE report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_profiles_document_id_idx
  ON public.document_profiles (document_id)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_profiles_type_period_idx
  ON public.document_profiles (company_id, document_type, period);

CREATE INDEX IF NOT EXISTS document_profiles_structured_data_gin
  ON public.document_profiles USING gin (structured_data);

DROP TRIGGER IF EXISTS document_profiles_set_updated_at ON public.document_profiles;
CREATE TRIGGER document_profiles_set_updated_at
  BEFORE UPDATE ON public.document_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_processing_updated_at();

ALTER TABLE public.document_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all document profiles" ON public.document_profiles;
CREATE POLICY "Admins read all document profiles"
  ON public.document_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company document profiles" ON public.document_profiles;
CREATE POLICY "Clients read own company document profiles"
  ON public.document_profiles FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Service role manages document profiles" ON public.document_profiles;
CREATE POLICY "Service role manages document profiles"
  ON public.document_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- sinexia_gpt_cache — cache expensive GPT answers per company/question/doc
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sinexia_gpt_cache (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key            TEXT NOT NULL UNIQUE,
  company_id           UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  document_processing_id UUID REFERENCES public.document_processing (id) ON DELETE CASCADE,
  question_normalized  TEXT NOT NULL,
  response             TEXT NOT NULL,
  model_name           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sinexia_gpt_cache_company_id_idx
  ON public.sinexia_gpt_cache (company_id);

CREATE INDEX IF NOT EXISTS sinexia_gpt_cache_expires_at_idx
  ON public.sinexia_gpt_cache (expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.sinexia_gpt_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all gpt cache" ON public.sinexia_gpt_cache;
CREATE POLICY "Admins read all gpt cache"
  ON public.sinexia_gpt_cache FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company gpt cache" ON public.sinexia_gpt_cache;
CREATE POLICY "Clients read own company gpt cache"
  ON public.sinexia_gpt_cache FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Service role manages gpt cache" ON public.sinexia_gpt_cache;
CREATE POLICY "Service role manages gpt cache"
  ON public.sinexia_gpt_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
