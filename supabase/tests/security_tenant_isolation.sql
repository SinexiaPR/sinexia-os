-- Run with psql after applying 20250713030000_security_tenant_hardening.sql.
-- Uses existing profiles and rolls all writes back.
BEGIN;
SELECT set_config('audit.client_id',id::TEXT,true),set_config('audit.client_company',company_id::TEXT,true)
FROM public.profiles WHERE role='client' ORDER BY email LIMIT 1;
SELECT set_config('audit.other_report',COALESCE((SELECT id::TEXT FROM public.reports WHERE company_id<>current_setting('audit.client_company')::UUID LIMIT 1),''),true);
SELECT set_config('audit.other_document',COALESCE((SELECT id::TEXT FROM public.documents WHERE company_id<>current_setting('audit.client_company')::UUID LIMIT 1),''),true);
SELECT set_config('audit.other_notification',COALESCE((SELECT id::TEXT FROM public.notifications WHERE audience='client' AND company_id<>current_setting('audit.client_company')::UUID LIMIT 1),''),true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('audit.client_id'),true);

DO $$ DECLARE allowed BOOLEAN:=false;
BEGIN
  BEGIN UPDATE public.profiles SET role='admin' WHERE id=auth.uid(); allowed:=FOUND; EXCEPTION WHEN OTHERS THEN allowed:=false; END;
  IF allowed THEN RAISE EXCEPTION 'RLS failure: client changed role'; END IF;
  BEGIN UPDATE public.profiles SET company_id=gen_random_uuid() WHERE id=auth.uid(); allowed:=FOUND; EXCEPTION WHEN OTHERS THEN allowed:=false; END;
  IF allowed THEN RAISE EXCEPTION 'RLS failure: client changed company'; END IF;
END $$;

DO $$ DECLARE value UUID; allowed BOOLEAN:=false;
BEGIN
  value:=NULLIF(current_setting('audit.other_report'),'')::UUID;
  IF value IS NOT NULL THEN BEGIN INSERT INTO public.report_views(user_id,report_id) VALUES(auth.uid(),value); allowed:=true; EXCEPTION WHEN OTHERS THEN allowed:=false; END; END IF;
  IF allowed THEN RAISE EXCEPTION 'RLS failure: cross-company report_view allowed'; END IF;
  value:=NULLIF(current_setting('audit.other_document'),'')::UUID;
  IF value IS NOT NULL THEN BEGIN INSERT INTO public.document_views(user_id,document_id) VALUES(auth.uid(),value); allowed:=true; EXCEPTION WHEN OTHERS THEN allowed:=false; END; END IF;
  IF allowed THEN RAISE EXCEPTION 'RLS failure: cross-company document_view allowed'; END IF;
  value:=NULLIF(current_setting('audit.other_notification'),'')::UUID;
  IF value IS NOT NULL THEN BEGIN INSERT INTO public.notification_reads(user_id,notification_id) VALUES(auth.uid(),value); allowed:=true; EXCEPTION WHEN OTHERS THEN allowed:=false; END; END IF;
  IF allowed THEN RAISE EXCEPTION 'RLS failure: cross-company notification read allowed'; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.calendar_items) THEN RAISE EXCEPTION 'RLS failure: client read admin calendar'; END IF;
  IF EXISTS(SELECT 1 FROM public.calendar_item_comments) THEN RAISE EXCEPTION 'RLS failure: client read calendar comments'; END IF;
END $$;
ROLLBACK;
