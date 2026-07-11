"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  countUnreadNotifications,
  getNotificationsForUser,
  markNotificationsReadForEntity,
  markSingleNotificationRead,
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

  const result = await markSingleNotificationRead({
    userId: profile.id,
    notificationId,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const profile = await requireAuth();

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

  const supabase = await createClient();
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

  const related = await markNotificationsReadForEntity({
    userId: profile.id,
    role: profile.role,
    companyId: profile.company_id,
    reportId,
  });

  if (related.error) {
    return { error: related.error };
  }

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function markDocumentViewed(documentId: string) {
  const profile = await requireAuth();
  if (!documentId) {
    return { error: "Documento no válido." };
  }

  const supabase = await createClient();

  if (profile.role === "client") {
    if (!profile.company_id) {
      return { error: "No autorizado." };
    }

    const { data: document } = await supabase
      .from("documents")
      .select("id, company_id")
      .eq("id", documentId)
      .maybeSingle();

    if (!document || document.company_id !== profile.company_id) {
      return { error: "Documento no encontrado." };
    }
  }

  const related = await markNotificationsReadForEntity({
    userId: profile.id,
    role: profile.role,
    companyId: profile.company_id,
    documentId,
  });

  if (related.error) {
    return { error: related.error };
  }

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function openNotification(params: {
  notificationId: string;
  reportId?: string | null;
  documentId?: string | null;
}) {
  const profile = await requireAuth();
  const { notificationId, reportId, documentId } = params;

  if (!notificationId) {
    return { error: "Notificación no válida." };
  }

  const readResult = await markSingleNotificationRead({
    userId: profile.id,
    notificationId,
  });
  if (readResult.error) {
    return { error: readResult.error };
  }

  if (reportId) {
    const reportResult = await markReportViewed(reportId);
    if (reportResult.error) {
      return { error: reportResult.error };
    }
  } else if (documentId) {
    const documentResult = await markDocumentViewed(documentId);
    if (documentResult.error) {
      return { error: documentResult.error };
    }
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/inbox");
  return { success: true };
}
