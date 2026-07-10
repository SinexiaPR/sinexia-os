-- Run in Supabase SQL Editor to inspect migration and schema state.
-- Does not modify any data.

-- Recorded Supabase CLI migrations (empty if applied manually outside CLI)
SELECT
  version,
  name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Expected local migration versions:
--   20250709180000  sprint1_auth_companies_documents
--   20250709200000  expand_storage_mime_types
--   20250709210000  module1_reports
--   20250709220000  update_report_categories

-- Enum types
SELECT typname AS enum_type
FROM pg_type
WHERE typnamespace = 'public'::regnamespace
  AND typtype = 'e'
ORDER BY typname;

-- report_category values (if present)
SELECT enumlabel AS report_category_value
FROM pg_enum AS enum_value
JOIN pg_type AS enum_type ON enum_value.enumtypid = enum_type.oid
WHERE enum_type.typname = 'report_category'
ORDER BY enumsortorder;

-- Core tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'profiles', 'documents', 'reports')
ORDER BY tablename;

-- Storage buckets
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('documents', 'reports')
ORDER BY id;

-- Row counts (read-only sanity check)
SELECT 'companies' AS table_name, COUNT(*) AS row_count FROM public.companies
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'documents', COUNT(*) FROM public.documents
UNION ALL
SELECT 'reports', COUNT(*) FROM public.reports;
