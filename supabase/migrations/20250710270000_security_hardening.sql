-- Authorization and multi-tenant integrity hardening.
-- Idempotent and non-destructive: existing business rows are not rewritten.

-- ---------------------------------------------------------------------------
-- Profiles: safe signup defaults and immutable authorization fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_client_requires_company;

-- A newly-created client may remain unassigned until a trusted server-side
-- onboarding flow assigns a company. Admins must never be company-scoped.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_admin_no_company;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admin_no_company
  CHECK (role = 'client' OR company_id IS NULL) NOT VALID;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1)),
    'client',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_authorization_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     OR OLD.company_id IS DISTINCT FROM NEW.company_id
     OR OLD.email IS DISTINCT FROM NEW.email THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'profile authorization fields require a trusted server-side flow'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_authorization_fields ON public.profiles;
CREATE TRIGGER profiles_protect_authorization_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_authorization_fields();

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON TABLE public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- Entity authorization helpers used by RLS policies
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_report(p_report_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.id = p_report_id
      AND (
        public.is_admin()
        OR r.company_id = public.current_company_id()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_notification(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.id = p_notification_id
      AND (
        (public.is_admin() AND n.audience = 'admin')
        OR (
          n.audience = 'client'
          AND n.company_id = public.current_company_id()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_report(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_access_notification(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_notification(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users read own report views" ON public.report_views;
CREATE POLICY "Users read authorized own report views"
  ON public.report_views FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_access_report(report_id));

DROP POLICY IF EXISTS "Users insert own report views" ON public.report_views;
CREATE POLICY "Users insert authorized own report views"
  ON public.report_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_report(report_id));

DROP POLICY IF EXISTS "Users update own report views" ON public.report_views;
CREATE POLICY "Users update authorized own report views"
  ON public.report_views FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.can_access_report(report_id))
  WITH CHECK (user_id = auth.uid() AND public.can_access_report(report_id));

DROP POLICY IF EXISTS "Users read own notification reads" ON public.notification_reads;
CREATE POLICY "Users read authorized own notification reads"
  ON public.notification_reads FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_notification(notification_id)
  );

DROP POLICY IF EXISTS "Users insert own notification reads" ON public.notification_reads;
CREATE POLICY "Users insert authorized own notification reads"
  ON public.notification_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_notification(notification_id)
  );

DROP POLICY IF EXISTS "Users update own notification reads" ON public.notification_reads;
CREATE POLICY "Users update authorized own notification reads"
  ON public.notification_reads FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_notification(notification_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_notification(notification_id)
  );

-- ---------------------------------------------------------------------------
-- Cross-table company integrity (also protects service-role writes)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_document_processing_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.report_id IS NOT NULL THEN
    SELECT company_id INTO STRICT v_company_id
    FROM public.reports WHERE id = NEW.report_id;
  ELSE
    SELECT company_id INTO STRICT v_company_id
    FROM public.documents WHERE id = NEW.document_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'document_processing company_id does not match its source'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_processing_company_integrity ON public.document_processing;
CREATE TRIGGER document_processing_company_integrity
  BEFORE INSERT OR UPDATE OF company_id, report_id, document_id
  ON public.document_processing
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_processing_company();

CREATE OR REPLACE FUNCTION public.enforce_document_profile_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_processing public.document_processing%ROWTYPE;
  v_source_company_id UUID;
BEGIN
  SELECT * INTO STRICT v_processing
  FROM public.document_processing
  WHERE id = NEW.document_processing_id;

  IF NEW.company_id IS DISTINCT FROM v_processing.company_id
     OR NEW.report_id IS DISTINCT FROM v_processing.report_id
     OR NEW.document_id IS DISTINCT FROM v_processing.document_id THEN
    RAISE EXCEPTION 'document_profile source does not match parent processing row'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.report_id IS NOT NULL THEN
    SELECT company_id INTO STRICT v_source_company_id
    FROM public.reports WHERE id = NEW.report_id;
  ELSE
    SELECT company_id INTO STRICT v_source_company_id
    FROM public.documents WHERE id = NEW.document_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_source_company_id THEN
    RAISE EXCEPTION 'document_profile company_id does not match its source'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_profiles_company_integrity ON public.document_profiles;
CREATE TRIGGER document_profiles_company_integrity
  BEFORE INSERT OR UPDATE OF company_id, report_id, document_id, document_processing_id
  ON public.document_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_profile_company();

CREATE OR REPLACE FUNCTION public.enforce_document_chunk_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO STRICT v_company_id
  FROM public.document_processing
  WHERE id = NEW.document_processing_id;

  IF NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION 'document_chunk company_id does not match parent processing row'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_chunks_company_integrity ON public.document_chunks;
CREATE TRIGGER document_chunks_company_integrity
  BEFORE INSERT OR UPDATE OF company_id, document_processing_id
  ON public.document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_document_chunk_company();

CREATE OR REPLACE FUNCTION public.enforce_notification_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.report_id IS NOT NULL THEN
    SELECT company_id INTO STRICT v_company_id
    FROM public.reports WHERE id = NEW.report_id;
    IF NEW.company_id IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'notification company_id does not match report company_id'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.document_id IS NOT NULL THEN
    SELECT company_id INTO STRICT v_company_id
    FROM public.documents WHERE id = NEW.document_id;
    IF NEW.company_id IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'notification company_id does not match document company_id'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.audience = 'client' AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'client notifications require company_id'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_company_integrity ON public.notifications;
CREATE TRIGGER notifications_company_integrity
  BEFORE INSERT OR UPDATE OF company_id, report_id, document_id, audience
  ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_company();
