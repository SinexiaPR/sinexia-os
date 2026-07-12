-- Admin-only collaborative calendar and task board.
-- Recurring series store one rule; per-occurrence state lives in the exception table.

DO $$ BEGIN
  CREATE TYPE public.calendar_item_type AS ENUM ('task', 'activity', 'reminder', 'internal_message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_priority AS ENUM ('routine', 'important', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  item_type public.calendar_item_type NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  event_date DATE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT true,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/Puerto_Rico',
  priority public.calendar_priority NOT NULL DEFAULT 'routine',
  status public.calendar_status NOT NULL DEFAULT 'pending',
  recurrence_rule JSONB,
  recurrence_until DATE,
  recurrence_parent_id UUID REFERENCES public.calendar_items(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  external_provider TEXT,
  external_event_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_item_time_order CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at),
  CONSTRAINT calendar_item_all_day_times CHECK (NOT all_day OR (start_at IS NULL AND end_at IS NULL)),
  CONSTRAINT calendar_item_recurrence_rule CHECK (
    recurrence_rule IS NULL OR (
      jsonb_typeof(recurrence_rule) = 'object'
      AND recurrence_rule->>'frequency' IN ('weekly', 'biweekly', 'monthly', 'weekdays')
    )
  )
);

CREATE TABLE IF NOT EXISTS public.calendar_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id UUID NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_item_occurrence_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id UUID NOT NULL REFERENCES public.calendar_items(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  status public.calendar_status,
  title TEXT CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 160),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (calendar_item_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS calendar_items_event_date_idx ON public.calendar_items(event_date);
CREATE INDEX IF NOT EXISTS calendar_items_status_idx ON public.calendar_items(status);
CREATE INDEX IF NOT EXISTS calendar_items_priority_idx ON public.calendar_items(priority);
CREATE INDEX IF NOT EXISTS calendar_items_company_idx ON public.calendar_items(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_items_assigned_idx ON public.calendar_items(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_items_recurrence_parent_idx ON public.calendar_items(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_comments_item_created_idx ON public.calendar_item_comments(calendar_item_id, created_at);
CREATE INDEX IF NOT EXISTS calendar_occurrence_item_date_idx ON public.calendar_item_occurrence_status(calendar_item_id, occurrence_date);

DROP TRIGGER IF EXISTS calendar_items_updated_at ON public.calendar_items;
CREATE TRIGGER calendar_items_updated_at BEFORE UPDATE ON public.calendar_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS calendar_comments_updated_at ON public.calendar_item_comments;
CREATE TRIGGER calendar_comments_updated_at BEFORE UPDATE ON public.calendar_item_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS calendar_occurrences_updated_at ON public.calendar_item_occurrence_status;
CREATE TRIGGER calendar_occurrences_updated_at BEFORE UPDATE ON public.calendar_item_occurrence_status
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.calendar_assignee_must_be_admin()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
    IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid();
    ELSE NEW.created_by := OLD.created_by; END IF;
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.assigned_to AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Calendar assignee must be an admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.created_by AND role = 'admin')
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.updated_by AND role = 'admin') THEN
    RAISE EXCEPTION 'Calendar authors must be admins';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS calendar_items_validate_admins ON public.calendar_items;
CREATE TRIGGER calendar_items_validate_admins BEFORE INSERT OR UPDATE ON public.calendar_items
FOR EACH ROW EXECUTE FUNCTION public.calendar_assignee_must_be_admin();

ALTER TABLE public.calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_item_occurrence_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage calendar items" ON public.calendar_items;
CREATE POLICY "Admins manage calendar items" ON public.calendar_items FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin() AND created_by IS NOT NULL AND updated_by = auth.uid());
DROP POLICY IF EXISTS "Admins manage calendar comments" ON public.calendar_item_comments;
CREATE POLICY "Admins manage calendar comments" ON public.calendar_item_comments FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin() AND user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage calendar occurrences" ON public.calendar_item_occurrence_status;
CREATE POLICY "Admins manage calendar occurrences" ON public.calendar_item_occurrence_status FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin() AND updated_by = auth.uid());

-- Extend existing notifications without exposing calendar data to clients.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS calendar_item_id UUID REFERENCES public.calendar_items(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS notifications_target_user_idx ON public.notifications(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_calendar_item_idx ON public.notifications(calendar_item_id) WHERE calendar_item_id IS NOT NULL;

-- TEXT keeps the existing values and allows future operational notification kinds
-- without enum-value/transaction ordering hazards.
ALTER TABLE public.notifications ALTER COLUMN kind TYPE TEXT USING kind::TEXT;

DROP POLICY IF EXISTS "Admins read admin notifications" ON public.notifications;
CREATE POLICY "Admins read admin notifications" ON public.notifications FOR SELECT TO authenticated
USING (public.is_admin() AND audience = 'admin' AND (target_user_id IS NULL OR target_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_calendar_item_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor TEXT; v_target UUID;
BEGIN
  SELECT COALESCE(full_name, email) INTO v_actor FROM public.profiles WHERE id = NEW.updated_by;
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,target_user_id,calendar_item_id)
    VALUES ('calendar_assigned:'||NEW.id||':'||NEW.assigned_to,'admin','calendar_assigned',NEW.company_id,'Nueva tarea asignada',NEW.title,'/dashboard/calendar?item='||NEW.id,NEW.assigned_to,NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,target_user_id,calendar_item_id)
    VALUES ('calendar_reassigned:'||NEW.id||':'||NEW.assigned_to||':'||NEW.updated_at,'admin','calendar_assigned',NEW.company_id,'Tarea asignada',NEW.title,'/dashboard/calendar?item='||NEW.id,NEW.assigned_to,NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.priority = 'urgent' THEN
    INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,calendar_item_id)
    VALUES ('calendar_urgent:'||NEW.id,'admin','calendar_urgent',NEW.company_id,'Actividad urgente creada',NEW.title,'/dashboard/calendar?item='||NEW.id,NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    v_target := COALESCE(NEW.created_by, NEW.assigned_to);
    INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,target_user_id,calendar_item_id)
    VALUES ('calendar_completed:'||NEW.id||':'||NEW.updated_at,'admin','calendar_completed',NEW.company_id,'Actividad completada',NEW.title||' · '||COALESCE(v_actor,'Equipo Sinexia'),'/dashboard/calendar?item='||NEW.id,v_target,NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notifications_calendar_item_events ON public.calendar_items;
CREATE TRIGGER notifications_calendar_item_events AFTER INSERT OR UPDATE OF assigned_to,status ON public.calendar_items
FOR EACH ROW EXECUTE FUNCTION public.notify_calendar_item_events();

CREATE OR REPLACE FUNCTION public.notify_calendar_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.calendar_items%ROWTYPE; v_author TEXT;
BEGIN
  SELECT * INTO v_item FROM public.calendar_items WHERE id = NEW.calendar_item_id;
  SELECT COALESCE(full_name,email) INTO v_author FROM public.profiles WHERE id = NEW.user_id;
  IF v_item.assigned_to IS NOT NULL AND v_item.assigned_to <> NEW.user_id THEN
    INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,target_user_id,calendar_item_id)
    VALUES ('calendar_comment:'||NEW.id,'admin','calendar_comment',v_item.company_id,'Nuevo comentario en una tarea',v_item.title||' · '||COALESCE(v_author,'Equipo Sinexia'),'/dashboard/calendar?item='||v_item.id,v_item.assigned_to,v_item.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notifications_calendar_comment ON public.calendar_item_comments;
CREATE TRIGGER notifications_calendar_comment AFTER INSERT ON public.calendar_item_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_calendar_comment();

CREATE OR REPLACE FUNCTION public.notify_calendar_occurrence_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.calendar_items%ROWTYPE;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO v_item FROM public.calendar_items WHERE id = NEW.calendar_item_id;
    INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,target_user_id,calendar_item_id)
    VALUES ('calendar_occurrence_completed:'||NEW.calendar_item_id||':'||NEW.occurrence_date,'admin','calendar_completed',v_item.company_id,'Actividad completada',v_item.title||' · '||NEW.occurrence_date,'/dashboard/calendar?item='||v_item.id,v_item.created_by,v_item.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notifications_calendar_occurrence_completed ON public.calendar_item_occurrence_status;
CREATE TRIGGER notifications_calendar_occurrence_completed AFTER INSERT OR UPDATE OF status ON public.calendar_item_occurrence_status
FOR EACH ROW EXECUTE FUNCTION public.notify_calendar_occurrence_completed();

-- Call daily from Supabase Cron. The dedupe key guarantees one notification per task/day.
CREATE OR REPLACE FUNCTION public.emit_calendar_due_notifications(p_date DATE DEFAULT (now() AT TIME ZONE 'America/Puerto_Rico')::DATE)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO public.notifications(dedupe_key,audience,kind,company_id,title,description,href,target_user_id,calendar_item_id)
  SELECT 'calendar_due:'||ci.id||':'||p_date,'admin','calendar_due_today',ci.company_id,'Actividad para hoy',ci.title,
         '/dashboard/calendar?item='||ci.id,ci.assigned_to,ci.id
  FROM public.calendar_items ci
  WHERE ci.event_date <= p_date
    AND (ci.recurrence_until IS NULL OR ci.recurrence_until >= p_date)
    AND ci.status IN ('pending','in_progress')
    AND (
      (ci.recurrence_rule IS NULL AND ci.event_date = p_date)
      OR (ci.recurrence_rule->>'frequency' = 'weekly' AND (p_date - ci.event_date) % 7 = 0)
      OR (ci.recurrence_rule->>'frequency' = 'biweekly' AND (p_date - ci.event_date) % 14 = 0)
      OR (ci.recurrence_rule->>'frequency' = 'weekdays' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(ci.recurrence_rule->'weekdays', '[]'::JSONB)) weekday
        WHERE weekday::INTEGER = EXTRACT(DOW FROM p_date)::INTEGER
      ))
      OR (ci.recurrence_rule->>'frequency' = 'monthly' AND ci.recurrence_rule->>'monthlyMode' = 'same_day' AND EXTRACT(DAY FROM ci.event_date) = EXTRACT(DAY FROM p_date))
      OR (ci.recurrence_rule->>'frequency' = 'monthly' AND ci.recurrence_rule->>'monthlyMode' = 'last_business_day'
          AND EXTRACT(ISODOW FROM p_date) < 6
          AND (p_date + CASE EXTRACT(ISODOW FROM p_date) WHEN 5 THEN 3 ELSE 1 END::INTEGER) > date_trunc('month', p_date)::DATE + INTERVAL '1 month - 1 day')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.calendar_item_occurrence_status ex
      WHERE ex.calendar_item_id = ci.id AND ex.occurrence_date = p_date AND ex.status IN ('completed','cancelled')
    )
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END; $$;

COMMENT ON COLUMN public.calendar_items.external_provider IS 'Reserved for future Google Calendar synchronization.';
COMMENT ON COLUMN public.calendar_items.recurrence_rule IS 'Compact rule evaluated only for requested date ranges; no future occurrence rows are generated.';
