import { createClient } from "@/lib/supabase/server";
import {
  expandCalendarItems,
  sortCalendarItems,
} from "@/lib/calendar/recurrence";
import type {
  CalendarComment,
  CalendarItem,
  CalendarOption,
  RecurrenceRule,
} from "@/types/calendar";

type ProfileJoin = { full_name: string | null; email: string } | null;
type ExceptionRow = {
  calendar_item_id: string;
  occurrence_date: string;
  status: CalendarItem["status"] | null;
  title: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  completed_at: string | null;
};

function profileName(profile: ProfileJoin) {
  return profile?.full_name ?? profile?.email ?? "Equipo Sinexia";
}

export async function getCalendarOptions(): Promise<{
  companies: CalendarOption[];
  admins: CalendarOption[];
}> {
  const supabase = await createClient();
  const [{ data: companies }, { data: admins }] = await Promise.all([
    supabase.from("companies").select("id,name").order("name"),
    supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("role", "admin")
      .order("full_name"),
  ]);
  return {
    companies: (companies ?? []).map((row) => ({ id: row.id, name: row.name })),
    admins: (admins ?? []).map((row) => ({
      id: row.id,
      name: row.full_name ?? row.email,
    })),
  };
}

export async function getCalendarItems(
  from: string,
  to: string,
): Promise<CalendarItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_items")
    .select(
      "*,companies(name),assignee:profiles!calendar_items_assigned_to_fkey(full_name,email),creator:profiles!calendar_items_created_by_fkey(full_name,email),updater:profiles!calendar_items_updated_by_fkey(full_name,email)",
    )
    .lte("event_date", to)
    .or(`recurrence_until.is.null,recurrence_until.gte.${from}`)
    .order("event_date");
  if (error)
    throw new Error(`No se pudo cargar el calendario: ${error.message}`);

  const base: CalendarItem[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    itemType: row.item_type,
    companyId: row.company_id,
    companyName: (row.companies as { name?: string } | null)?.name ?? null,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_to
      ? profileName(row.assignee as ProfileJoin)
      : null,
    createdBy: row.created_by,
    createdByName: profileName(row.creator as ProfileJoin),
    updatedBy: row.updated_by,
    updatedByName: profileName(row.updater as ProfileJoin),
    eventDate: row.event_date,
    occurrenceDate: row.event_date,
    allDay: row.all_day,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    priority: row.priority,
    status: row.status,
    recurrenceRule: row.recurrence_rule as RecurrenceRule | null,
    recurrenceUntil: row.recurrence_until,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const expanded = expandCalendarItems(base, from, to);
  if (!expanded.length) return [];

  const ids = [
    ...new Set(
      expanded.filter((item) => item.recurrenceRule).map((item) => item.id),
    ),
  ];
  if (!ids.length) return expanded;
  const { data: exceptions } = await supabase
    .from("calendar_item_occurrence_status")
    .select(
      "calendar_item_id,occurrence_date,status,title,description,start_at,end_at,completed_at",
    )
    .in("calendar_item_id", ids)
    .gte("occurrence_date", from)
    .lte("occurrence_date", to);
  const byKey = new Map(
    ((exceptions as ExceptionRow[] | null) ?? []).map((row) => [
      `${row.calendar_item_id}:${row.occurrence_date}`,
      row,
    ]),
  );
  return expanded.map((item) => {
    const override = byKey.get(`${item.id}:${item.occurrenceDate}`);
    return override
      ? {
          ...item,
          status: override.status ?? item.status,
          title: override.title ?? item.title,
          description: override.description ?? item.description,
          startAt: override.start_at ?? item.startAt,
          endAt: override.end_at ?? item.endAt,
          completedAt: override.completed_at ?? item.completedAt,
        }
      : item;
  });
}

export async function getCalendarDashboard(today: string) {
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 31);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 40);
  const items = sortCalendarItems(
    await getCalendarItems(
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10),
    ),
    today,
  );
  const upcomingEnd = new Date(`${today}T12:00:00Z`);
  upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 7);
  const upcomingDate = upcomingEnd.toISOString().slice(0, 10);
  const weekStart = new Date(`${today}T12:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  return {
    items,
    dueToday: items.filter(
      (i) =>
        i.occurrenceDate === today &&
        i.status !== "completed" &&
        i.status !== "cancelled",
    ),
    upcoming: items
      .filter(
        (i) =>
          i.occurrenceDate > today &&
          i.occurrenceDate <= upcomingDate &&
          i.status !== "completed" &&
          i.status !== "cancelled",
      )
      .slice(0, 5),
    overdue: items
      .filter(
        (i) =>
          i.occurrenceDate < today &&
          i.status !== "completed" &&
          i.status !== "cancelled",
      )
      .slice(0, 5),
    completedThisWeek: items.filter(
      (i) =>
        i.status === "completed" &&
        i.completedAt &&
        i.completedAt.slice(0, 10) >= weekStart.toISOString().slice(0, 10),
    ).length,
  };
}

export async function getCalendarComments(
  itemId: string,
): Promise<CalendarComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_item_comments")
    .select("*,profiles(full_name,email)")
    .eq("calendar_item_id", itemId)
    .order("created_at");
  return (data ?? []).map((row) => ({
    id: row.id,
    calendarItemId: row.calendar_item_id,
    userId: row.user_id,
    authorName: profileName(row.profiles as ProfileJoin),
    content: row.content,
    createdAt: row.created_at,
  }));
}
