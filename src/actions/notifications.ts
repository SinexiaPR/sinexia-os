"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  countUnreadNotifications,
  getNotificationsForUser,
} from "@/services/notifications";

export async function fetchNotifications() {
  const profile = await requireAuth();

  const notifications = await getNotificationsForUser({
    userId: profile.id,
    role: profile.role,
    companyId: profile.company_id,
    limit: 20,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
}

export async function getNotificationUnreadCount() {
  const profile = await requireAuth();

  const unreadCount = await countUnreadNotifications({
    userId: profile.id,
    role: profile.role,
    companyId: profile.company_id,
  });

  return { unreadCount };
}

export async function markNotificationRead(notificationId: string) {
  const profile = await requireAuth();
  if (!notificationId) {
    return { error: "Notificación no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("notification_reads").upsert(
    {
      notification_id: notificationId,
      user_id: profile.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id" },
  );

  if (error) {
    return { error: "No se pudo marcar la notificación." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const profile = await requireAuth();
  const supabase = await createClient();

  const notifications = await getNotificationsForUser({
    userId: profile.id,
    role: profile.role,
    companyId: profile.company_id,
    limit: 50,
  });

  const unread = notifications.filter((n) => !n.read);
  if (!unread.length) {
    return { success: true };
  }

  const rows = unread.map((n) => ({
    notification_id: n.id,
    user_id: profile.id,
    read_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("notification_reads").upsert(rows, {
    onConflict: "notification_id,user_id",
  });

  if (error) {
    return { error: "No se pudieron marcar las notificaciones." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function markReportViewed(reportId: string) {
  const profile = await requireAuth();
  if (!reportId) {
    return { error: "Reporte no válido." };
  }

  if (profile.role === "client" && !profile.company_id) {
    return { error: "No autorizado." };
  }

  const supabase = await createClient();

  if (profile.role === "client") {
    const { data: report } = await supabase
      .from("reports")
      .select("id, company_id")
      .eq("id", reportId)
      .maybeSingle();

    if (!report || report.company_id !== profile.company_id) {
      return { error: "Reporte no encontrado." };
    }
  }

  const { error } = await supabase.from("report_views").upsert(
    {
      user_id: profile.id,
      report_id: reportId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,report_id" },
  );

  if (error) {
    return { error: "No se pudo registrar la visita al reporte." };
  }

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
