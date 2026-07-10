-- Sinexia OS — Sprint 1: Auth, companies, documents
-- Idempotent: safe to re-run against an existing database.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'client');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.document_status AS ENUM (
    'received',
    'reviewing',
    'processed',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companies_slug_idx ON public.companies (slug);

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        public.user_role NOT NULL DEFAULT 'client',
  company_id  UUID REFERENCES public.companies (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_client_requires_company CHECK (
    role = 'admin' OR company_id IS NOT NULL
  ),
  CONSTRAINT profiles_admin_no_company CHECK (
    role = 'client' OR company_id IS NULL
  )
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON public.profiles (company_id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_client_per_company_idx
  ON public.profiles (company_id)
  WHERE role = 'client';

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  supplier        TEXT NOT NULL,
  invoice_number  TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  due_date        DATE,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  document_type   TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  status          public.document_status NOT NULL DEFAULT 'received',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_company_id_idx ON public.documents (company_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON public.documents (status);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents (created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND role = 'client';
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
  user_company_id UUID;
BEGIN
  user_role := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::public.user_role,
    'client'
  );

  user_company_id := NULLIF(NEW.raw_user_meta_data ->> 'company_id', '')::UUID;

  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    user_role,
    CASE WHEN user_role = 'admin' THEN NULL ELSE user_company_id END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all companies" ON public.companies;
CREATE POLICY "Admins read all companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company" ON public.companies;
CREATE POLICY "Clients read own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (id = public.current_company_id());

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins read all documents" ON public.documents;
CREATE POLICY "Admins read all documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Clients read own company documents" ON public.documents;
CREATE POLICY "Clients read own company documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Clients insert own company documents" ON public.documents;
CREATE POLICY "Clients insert own company documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id()
    AND uploaded_by = auth.uid()
    AND status = 'received'
  );

DROP POLICY IF EXISTS "Admins update document status" ON public.documents;
CREATE POLICY "Admins update document status"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket for document files
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins read all document files" ON storage.objects;
CREATE POLICY "Admins read all document files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Clients read own company document files" ON storage.objects;
CREATE POLICY "Clients read own company document files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::TEXT
  );

DROP POLICY IF EXISTS "Clients upload to own company folder" ON storage.objects;
CREATE POLICY "Clients upload to own company folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_company_id()::TEXT
  );

DROP POLICY IF EXISTS "Admins upload document files" ON storage.objects;
CREATE POLICY "Admins upload document files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Seed companies (Sprint 1)
-- ---------------------------------------------------------------------------

INSERT INTO public.companies (name, slug) VALUES
  ('Sibarita', 'sibarita'),
  ('Tresbe', 'tresbe'),
  ('Cut', 'cut'),
  ('Cut Meat Distributors', 'cut-meat-distributors'),
  ('Magol', 'magol')
ON CONFLICT (slug) DO NOTHING;
