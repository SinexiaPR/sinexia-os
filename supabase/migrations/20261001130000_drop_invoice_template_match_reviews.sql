-- Removes invoice_template_match_reviews, a one-time audit table created by
-- 20250714100000_invoice_permissions_weekly_defaults.sql to record how the
-- initial 5 "weekly-*" recurring_invoice_profiles rows were matched against
-- companies by name/alias on 2026-07-14. No application code reads this
-- table (confirmed via repo-wide search); it was never more than a
-- point-in-time audit log for that one seeding migration. Dropped as part
-- of removing the "Preparación recurrente" feature.
drop table if exists public.invoice_template_match_reviews;
