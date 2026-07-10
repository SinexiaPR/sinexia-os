-- Module 1: Reports — table, storage bucket, RLS
-- Idempotent: safe to re-run against an existing database.

DO $$
BEGIN
  CREATE TYPE public.report_category AS ENUM (
    'Aging',
    'Profit & Loss',
    'Balance Sheet',
    'Bank Reconciliation',
    'Payroll',
    'Statement',
    'Custom Report'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  title       TEXT NOT NULL,
  category    public.report_category NOT NULL,
  period      TEXT NOT NULL,
  notes       TEXT,
  file_url    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_company_id_idx ON public.reports (company_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_category_idx ON public.reports (category);

DROP TRIGGER IF EXISTS reports_updated_at ON public.reports;
CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all reports" ON public.reports;
CREATE POLICY "Admins read all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company reports" ON public.reports;
CREATE POLICY "Clients read own company reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Admins insert reports" ON public.reports;
CREATE POLICY "Admins insert reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete reports" ON public.reports;
CREATE POLICY "Admins delete reports"
  ON public.reports FOR DELETE
  TO authenticated
  USING (public.is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins read all report files" ON storage.objects;
CREATE POLICY "Admins read all report files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Clients read own company report files" ON storage.objects;
CREATE POLICY "Clients read own company report files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = public.current_company_id()::TEXT
  );

DROP POLICY IF EXISTS "Admins upload report files" ON storage.objects;
CREATE POLICY "Admins upload report files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins delete report files" ON storage.objects;
CREATE POLICY "Admins delete report files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND public.is_admin()
  );
