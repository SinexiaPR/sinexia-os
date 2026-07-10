-- Mark migrations as already applied when objects exist but CLI history is missing.
-- Run ONLY after confirming objects exist via verify-migration-state.sql.
-- Safe to run multiple times.

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES
  ('20250709180000', 'sprint1_auth_companies_documents'),
  ('20250709200000', 'expand_storage_mime_types'),
  ('20250709210000', 'module1_reports'),
  ('20250709220000', 'update_report_categories')
ON CONFLICT (version) DO NOTHING;
