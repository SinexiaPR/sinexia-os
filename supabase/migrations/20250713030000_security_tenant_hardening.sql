-- Security and multi-tenant hardening. Idempotent and data preserving.

-- Public signups receive an unassigned client profile. Role/company assignment is admin/server-only.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_client_requires_company;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles(id,email,full_name,role,company_id)
  VALUES(NEW.id,NEW.email,COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),split_part(NEW.email,'@',1)),'client',NULL)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_profile_authorization_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid()=OLD.id AND NOT public.is_admin() AND (
    NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id OR
    NEW.email IS DISTINCT FROM OLD.email OR NEW.id IS DISTINCT FROM OLD.id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
  ) THEN RAISE EXCEPTION 'Only an administrator may change profile authorization fields'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_protect_authorization ON public.profiles;
CREATE TRIGGER profiles_protect_authorization BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_authorization_fields();
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING(id=auth.uid()) WITH CHECK(id=auth.uid() AND role='client' AND company_id IS NOT DISTINCT FROM public.current_company_id());
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());

CREATE OR REPLACE FUNCTION public.validate_document_uploader_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE uploader public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO uploader FROM public.profiles WHERE id=NEW.uploaded_by;
  IF uploader.id IS NULL OR (uploader.role='client' AND uploader.company_id IS DISTINCT FROM NEW.company_id)
  THEN RAISE EXCEPTION 'document company does not match client uploader'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS documents_uploader_company_integrity ON public.documents;
CREATE TRIGGER documents_uploader_company_integrity BEFORE INSERT OR UPDATE OF company_id,uploaded_by ON public.documents FOR EACH ROW EXECUTE FUNCTION public.validate_document_uploader_company();

-- Entity ownership helpers for per-user read/view records.
CREATE OR REPLACE FUNCTION public.can_access_report(value UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.reports r WHERE r.id=value AND (public.is_admin() OR r.company_id=public.current_company_id()));
$$;
CREATE OR REPLACE FUNCTION public.can_access_document(value UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.documents d WHERE d.id=value AND (public.is_admin() OR d.company_id=public.current_company_id()));
$$;
CREATE OR REPLACE FUNCTION public.can_access_notification(value UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.notifications n WHERE n.id=value AND (
    (public.is_admin() AND n.audience='admin' AND (n.target_user_id IS NULL OR n.target_user_id=auth.uid())) OR
    (NOT public.is_admin() AND n.audience='client' AND n.company_id=public.current_company_id())
  ));
$$;

DROP POLICY IF EXISTS "Users read own report views" ON public.report_views;
CREATE POLICY "Users read own report views" ON public.report_views FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.can_access_report(report_id));
DROP POLICY IF EXISTS "Users insert own report views" ON public.report_views;
CREATE POLICY "Users insert own report views" ON public.report_views FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.can_access_report(report_id));
DROP POLICY IF EXISTS "Users update own report views" ON public.report_views;
CREATE POLICY "Users update own report views" ON public.report_views FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.can_access_report(report_id)) WITH CHECK(user_id=auth.uid() AND public.can_access_report(report_id));

DROP POLICY IF EXISTS "Users read own document views" ON public.document_views;
CREATE POLICY "Users read own document views" ON public.document_views FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.can_access_document(document_id));
DROP POLICY IF EXISTS "Users insert own document views" ON public.document_views;
CREATE POLICY "Users insert own document views" ON public.document_views FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.can_access_document(document_id));
DROP POLICY IF EXISTS "Users update own document views" ON public.document_views;
CREATE POLICY "Users update own document views" ON public.document_views FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.can_access_document(document_id)) WITH CHECK(user_id=auth.uid() AND public.can_access_document(document_id));

DROP POLICY IF EXISTS "Users read own notification reads" ON public.notification_reads;
CREATE POLICY "Users read own notification reads" ON public.notification_reads FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.can_access_notification(notification_id));
DROP POLICY IF EXISTS "Users insert own notification reads" ON public.notification_reads;
CREATE POLICY "Users insert own notification reads" ON public.notification_reads FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.can_access_notification(notification_id));
DROP POLICY IF EXISTS "Users update own notification reads" ON public.notification_reads;
CREATE POLICY "Users update own notification reads" ON public.notification_reads FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.can_access_notification(notification_id)) WITH CHECK(user_id=auth.uid() AND public.can_access_notification(notification_id));

-- Reject cross-company source relationships at the database boundary.
CREATE OR REPLACE FUNCTION public.validate_document_processing_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE expected UUID;
BEGIN
  IF NEW.report_id IS NOT NULL THEN SELECT company_id INTO expected FROM public.reports WHERE id=NEW.report_id;
  ELSE SELECT company_id INTO expected FROM public.documents WHERE id=NEW.document_id; END IF;
  IF expected IS NULL OR NEW.company_id IS DISTINCT FROM expected THEN RAISE EXCEPTION 'document_processing company does not match source'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS document_processing_company_integrity ON public.document_processing;
CREATE TRIGGER document_processing_company_integrity BEFORE INSERT OR UPDATE OF company_id,report_id,document_id ON public.document_processing FOR EACH ROW EXECUTE FUNCTION public.validate_document_processing_company();

CREATE OR REPLACE FUNCTION public.validate_document_profile_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE processing public.document_processing%ROWTYPE;
BEGIN
  SELECT * INTO processing FROM public.document_processing WHERE id=NEW.document_processing_id;
  IF processing.id IS NULL OR NEW.company_id IS DISTINCT FROM processing.company_id OR
     NEW.report_id IS DISTINCT FROM processing.report_id OR NEW.document_id IS DISTINCT FROM processing.document_id
  THEN RAISE EXCEPTION 'document_profile does not match processing source'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS document_profiles_company_integrity ON public.document_profiles;
CREATE TRIGGER document_profiles_company_integrity BEFORE INSERT OR UPDATE OF company_id,document_processing_id,report_id,document_id ON public.document_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_document_profile_company();

CREATE OR REPLACE FUNCTION public.validate_document_chunk_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.document_processing p WHERE p.id=NEW.document_processing_id AND p.company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'document_chunk company does not match processing'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS document_chunks_company_integrity ON public.document_chunks;
CREATE TRIGGER document_chunks_company_integrity BEFORE INSERT OR UPDATE OF company_id,document_processing_id ON public.document_chunks FOR EACH ROW EXECUTE FUNCTION public.validate_document_chunk_company();

CREATE OR REPLACE FUNCTION public.validate_notification_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.report_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.reports r WHERE r.id=NEW.report_id AND r.company_id=NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match report'; END IF;
  IF NEW.document_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.id=NEW.document_id AND d.company_id=NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match document'; END IF;
  IF NEW.calendar_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.calendar_items c WHERE c.id=NEW.calendar_item_id AND c.company_id IS NOT DISTINCT FROM NEW.company_id) THEN RAISE EXCEPTION 'notification company does not match calendar item'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notifications_company_integrity ON public.notifications;
CREATE TRIGGER notifications_company_integrity BEFORE INSERT OR UPDATE OF company_id,report_id,document_id,calendar_item_id ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.validate_notification_company();

CREATE OR REPLACE FUNCTION public.validate_sinexia_message_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.sinexia_conversations c WHERE c.id=NEW.conversation_id AND c.company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'message company does not match conversation'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sinexia_messages_company_integrity ON public.sinexia_messages;
CREATE TRIGGER sinexia_messages_company_integrity BEFORE INSERT OR UPDATE OF company_id,conversation_id ON public.sinexia_messages FOR EACH ROW EXECUTE FUNCTION public.validate_sinexia_message_company();

CREATE OR REPLACE FUNCTION public.validate_payroll_entry_company()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.weekly_payrolls p JOIN public.payroll_employees e ON e.id=NEW.employee_id WHERE p.id=NEW.payroll_id AND p.company_id=e.company_id AND public.is_sibarita_company(p.company_id))
  THEN RAISE EXCEPTION 'payroll entry employee does not match payroll company'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS weekly_payroll_entries_company_integrity ON public.weekly_payroll_entries;
CREATE TRIGGER weekly_payroll_entries_company_integrity BEFORE INSERT OR UPDATE OF payroll_id,employee_id ON public.weekly_payroll_entries FOR EACH ROW EXECUTE FUNCTION public.validate_payroll_entry_company();

-- Abort rather than silently accepting pre-existing inconsistent data.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.document_processing p LEFT JOIN public.reports r ON r.id=p.report_id LEFT JOIN public.documents d ON d.id=p.document_id WHERE p.company_id IS DISTINCT FROM COALESCE(r.company_id,d.company_id)) THEN RAISE EXCEPTION 'Existing document_processing company mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.document_profiles dp JOIN public.document_processing p ON p.id=dp.document_processing_id WHERE dp.company_id IS DISTINCT FROM p.company_id OR dp.report_id IS DISTINCT FROM p.report_id OR dp.document_id IS DISTINCT FROM p.document_id) THEN RAISE EXCEPTION 'Existing document_profile mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.document_chunks c JOIN public.document_processing p ON p.id=c.document_processing_id WHERE c.company_id IS DISTINCT FROM p.company_id) THEN RAISE EXCEPTION 'Existing document_chunk mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.report_views v JOIN public.profiles u ON u.id=v.user_id JOIN public.reports r ON r.id=v.report_id WHERE u.role='client' AND u.company_id IS DISTINCT FROM r.company_id) THEN RAISE EXCEPTION 'Existing cross-company report_view'; END IF;
  IF EXISTS(SELECT 1 FROM public.document_views v JOIN public.profiles u ON u.id=v.user_id JOIN public.documents d ON d.id=v.document_id WHERE u.role='client' AND u.company_id IS DISTINCT FROM d.company_id) THEN RAISE EXCEPTION 'Existing cross-company document_view'; END IF;
END $$;
