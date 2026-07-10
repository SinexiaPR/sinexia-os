-- Update report categories: add Bank Reconciliation, rename Bank Statement to Statement
-- Idempotent: no-op if report_category type does not exist yet.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'report_category'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    RETURN;
  END IF;

  ALTER TYPE public.report_category ADD VALUE IF NOT EXISTS 'Bank Reconciliation';

  IF EXISTS (
    SELECT 1
    FROM pg_enum AS enum_value
    JOIN pg_type AS enum_type ON enum_value.enumtypid = enum_type.oid
    WHERE enum_type.typname = 'report_category'
      AND enum_value.enumlabel = 'Bank Statement'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum AS enum_value
    JOIN pg_type AS enum_type ON enum_value.enumtypid = enum_type.oid
    WHERE enum_type.typname = 'report_category'
      AND enum_value.enumlabel = 'Statement'
  ) THEN
    ALTER TYPE public.report_category RENAME VALUE 'Bank Statement' TO 'Statement';
  END IF;
END $$;
