"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const optionalUuid = z
  .union([z.literal(""), z.string().uuid()])
  .transform((v) => v || null);
const itemSchema = z.object({
  id: z.string().uuid().optional(),
  occurrenceDate: z.string().date().optional(),
  editScope: z.enum(["occurrence", "future", "series"]).default("series"),
  title: z.string().trim().min(1).max(160),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => v || null),
  itemType: z.enum(["task", "activity", "reminder", "internal_message"]),
  companyId: optionalUuid,
  assignedTo: optionalUuid,
  eventDate: z.string().date(),
  allDay: z.coerce.boolean().default(false),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timezone: z
    .enum(["America/Puerto_Rico", "America/Argentina/Cordoba"])
    .default("America/Puerto_Rico"),
  priority: z.enum(["routine", "important", "urgent"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  recurrence: z.enum([
    "none",
    "weekly",
    "biweekly",
    "monthly",
    "weekdays",
    "last_business_day",
  ]),
  weekdays: z.array(z.coerce.number().min(0).max(6)).optional(),
  recurrenceUntil: z
    .union([z.literal(""), z.string().date()])
    .optional()
    .transform((v) => v || null),
});

function formObject(formData: FormData) {
  return {
    ...Object.fromEntries(formData),
    allDay: formData.get("allDay") === "on",
    weekdays: formData.getAll("weekdays"),
  };
}

function timestamp(date: string, time: string | undefined, timezone: string) {
  if (!time) return null;
  const offset = timezone === "America/Argentina/Cordoba" ? "-03:00" : "-04:00";
  return new Date(`${date}T${time}:00${offset}`).toISOString();
}

function recurrenceRule(data: z.infer<typeof itemSchema>) {
  if (data.recurrence === "none") return null;
  if (data.recurrence === "last_business_day")
    return { frequency: "monthly", monthlyMode: "last_business_day" };
  if (data.recurrence === "monthly")
    return { frequency: "monthly", monthlyMode: "same_day" };
  if (data.recurrence === "weekdays")
    return {
      frequency: "weekdays",
      weekdays: data.weekdays?.length
        ? data.weekdays
        : [new Date(`${data.eventDate}T12:00:00Z`).getUTCDay()],
    };
  return { frequency: data.recurrence };
}

function dayBefore(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export type CalendarActionState = {
  success?: boolean;
  message?: string;
  error?: string;
};

export async function saveCalendarItem(
  _state: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const profile = await requireAdmin();
  const parsed = itemSchema.safeParse(formObject(formData));
  if (!parsed.success)
    return { error: "Revisa los campos requeridos y vuelve a intentar." };
  const data = parsed.data;
  if (!data.allDay && (!data.startTime || !data.endTime))
    return { error: "Indica hora de inicio y finalización." };
  const startAt = data.allDay
    ? null
    : timestamp(data.eventDate, data.startTime, data.timezone);
  const endAt = data.allDay
    ? null
    : timestamp(data.eventDate, data.endTime, data.timezone);
  if (startAt && endAt && endAt <= startAt)
    return { error: "La hora de finalización debe ser posterior al inicio." };

  const supabase = await createClient();
  if (data.assignedTo) {
    const { data: assignee } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.assignedTo)
      .eq("role", "admin")
      .maybeSingle();
    if (!assignee)
      return { error: "Solo puedes asignar actividades a administradores." };
  }
  const values = {
    title: data.title,
    description: data.description,
    item_type: data.itemType,
    company_id: data.companyId,
    assigned_to: data.assignedTo,
    updated_by: profile.id,
    event_date: data.eventDate,
    all_day: data.allDay,
    start_at: startAt,
    end_at: endAt,
    timezone: data.timezone,
    priority: data.priority,
    status: data.status,
    recurrence_rule: recurrenceRule(data),
    recurrence_until: data.recurrenceUntil,
    completed_at: data.status === "completed" ? new Date().toISOString() : null,
  };

  let error: { message: string } | null = null;
  if (!data.id) {
    ({ error } = await supabase
      .from("calendar_items")
      .insert({ ...values, created_by: profile.id }));
  } else if (data.editScope === "occurrence" && data.occurrenceDate) {
    ({ error } = await supabase.from("calendar_item_occurrence_status").upsert(
      {
        calendar_item_id: data.id,
        occurrence_date: data.occurrenceDate,
        status: data.status,
        title: data.title,
        description: data.description,
        start_at: startAt,
        end_at: endAt,
        completed_at:
          data.status === "completed" ? new Date().toISOString() : null,
        updated_by: profile.id,
      },
      { onConflict: "calendar_item_id,occurrence_date" },
    ));
  } else if (data.editScope === "future" && data.occurrenceDate) {
    const { data: original, error: originalError } = await supabase
      .from("calendar_items")
      .select("id,created_by")
      .eq("id", data.id)
      .single();
    if (originalError || !original)
      return { error: "No se encontró la serie." };
    const first = await supabase
      .from("calendar_items")
      .update({
        recurrence_until: dayBefore(data.occurrenceDate),
        updated_by: profile.id,
      })
      .eq("id", data.id);
    if (first.error) error = first.error;
    else
      ({ error } = await supabase
        .from("calendar_items")
        .insert({
          ...values,
          event_date: data.occurrenceDate,
          created_by: original.created_by,
          recurrence_parent_id: data.id,
        }));
  } else {
    ({ error } = await supabase
      .from("calendar_items")
      .update(values)
      .eq("id", data.id));
  }
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Actividad guardada correctamente." };
}

export async function completeCalendarItem(
  itemId: string,
  occurrenceDate: string,
  recurring: boolean,
) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const values = {
    status: "completed" as const,
    completed_at: new Date().toISOString(),
    updated_by: profile.id,
  };
  const { error } = recurring
    ? await supabase
        .from("calendar_item_occurrence_status")
        .upsert(
          {
            calendar_item_id: itemId,
            occurrence_date: occurrenceDate,
            ...values,
          },
          { onConflict: "calendar_item_id,occurrence_date" },
        )
    : await supabase.from("calendar_items").update(values).eq("id", itemId);
  if (error) return { error: "No se pudo completar la actividad." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

export async function deleteCalendarItem(
  itemId: string,
  occurrenceDate?: string,
  scope: "occurrence" | "future" | "series" = "series",
) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  let error: { message: string } | null = null;
  if (scope === "occurrence" && occurrenceDate) {
    ({ error } = await supabase
      .from("calendar_item_occurrence_status")
      .upsert(
        {
          calendar_item_id: itemId,
          occurrence_date: occurrenceDate,
          status: "cancelled",
          updated_by: profile.id,
        },
        { onConflict: "calendar_item_id,occurrence_date" },
      ));
  } else if (scope === "future" && occurrenceDate) {
    ({ error } = await supabase
      .from("calendar_items")
      .update({
        recurrence_until: dayBefore(occurrenceDate),
        updated_by: profile.id,
      })
      .eq("id", itemId));
  } else
    ({ error } = await supabase
      .from("calendar_items")
      .delete()
      .eq("id", itemId));
  if (error) return { error: "No se pudo eliminar la actividad." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

export async function addCalendarComment(itemId: string, content: string) {
  const profile = await requireAdmin();
  const parsed = z.string().trim().min(1).max(1000).safeParse(content);
  if (!parsed.success)
    return { error: "El comentario debe tener entre 1 y 1000 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_item_comments")
    .insert({
      calendar_item_id: itemId,
      user_id: profile.id,
      content: parsed.data,
    });
  if (error) return { error: "No se pudo agregar el comentario." };
  revalidatePath("/dashboard/calendar");
  return { success: true };
}
