-- Run with psql after applying 20250712230000_admin_calendar.sql.
-- The transaction is rolled back and preserves all existing data.
BEGIN;

SELECT
  (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1) AS admin_id,
  (SELECT id FROM public.profiles WHERE role = 'client' ORDER BY created_at LIMIT 1) AS client_id
\gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'client_id', true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.calendar_items) THEN
    RAISE EXCEPTION 'RLS failure: client can read calendar_items';
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_item_comments) THEN
    RAISE EXCEPTION 'RLS failure: client can read calendar_item_comments';
  END IF;
  IF EXISTS (SELECT 1 FROM public.calendar_item_occurrence_status) THEN
    RAISE EXCEPTION 'RLS failure: client can read occurrence exceptions';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.calendar_items(title,item_type,event_date,created_by,updated_by)
    VALUES ('Unauthorized client item','task',CURRENT_DATE,auth.uid(),auth.uid());
    RAISE EXCEPTION 'RLS failure: client inserted a calendar item';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_id', true);

DO $$
DECLARE v_item UUID;
BEGIN
  INSERT INTO public.calendar_items(title,item_type,event_date,created_by,updated_by)
  VALUES ('RLS admin smoke test','task',CURRENT_DATE,auth.uid(),auth.uid())
  RETURNING id INTO v_item;

  INSERT INTO public.calendar_item_comments(calendar_item_id,user_id,content)
  VALUES (v_item,auth.uid(),'Admin collaboration remains operational.');

  UPDATE public.calendar_items SET status = 'completed', updated_by = auth.uid() WHERE id = v_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin update failed'; END IF;
END $$;

ROLLBACK;
