import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserRole } from "@/types";

const ADMIN_INBOX_KINDS = new Set([
  "client_document_uploaded",
  "requires_review",
  "processing_failed",
  "requires_ocr",
]);

const REPORT_NOTIFICATION_KINDS = new Set([
  "report_published",
  "sinexia_analysis_completed",
  "sinexia_analysis_failed",
  "processing_failed",
  "requires_ocr",
]);

const DOCUMENT_NOTIFICATION_KINDS = new Set([
  "document_received",
  "document_reviewing",
  "document_processed",
  "document_missing_info",
  "client_document_uploaded",
  "requires_review",
  "sinexia_analysis_completed",
  "sinexia_analysis_failed",
  "processing_failed",
  "requires_ocr",
]);

export { ADMIN_INBOX_KINDS, REPORT_NOTIFICATION_KINDS, DOCUMENT_NOTIFICATION_KINDS };

export async function upsertNotificationReads(
  supabase: SupabaseClient,
  userId: string,
  notificationIds: string[],
): Promise<{ error: string | null }> {
  if (!notificationIds.length) {
    return { error: null };
  }

  const readAt = new Date().toISOString();
  const rows = notificationIds.map((notificationId) => ({
    notification_id: notificationId,
    user_id: userId,
    read_at: readAt,
  }));

  const { error } = await supabase.from("notification_reads").upsert(rows, {
    onConflict: "notification_id,user_id",
  });

  if (error) {
    console.error("[notifications] upsertNotificationReads", error.message);
    return { error: "No se pudo actualizar el estado de lectura." };
  }

  return { error: null };
}

export async function markEntityNotificationsRead(params: {
  supabase: SupabaseClient;
  userId: string;
  role: UserRole;
  companyId?: string | null;
  reportId?: string | null;
  documentId?: string | null;
}): Promise<{ error: string | null; markedCount: number }> {
  const { supabase, userId, role, companyId, reportId, documentId } = params;

  if (!reportId && !documentId) {
    return { error: null, markedCount: 0 };
  }

  const audience = role === "admin" ? "admin" : "client";

  let query = supabase
    .from("notifications")
    .select("id, kind, report_id, document_id, company_id")
    .eq("audience", audience);

  if (audience === "client" && companyId) {
    query = query.eq("company_id", companyId);
  }

  if (reportId) {
    query = query.eq("report_id", reportId);
  } else if (documentId) {
    query = query.eq("document_id", documentId);
  }

  const { data: notifications, error: notificationsError } = await query;

  if (notificationsError) {
    console.error(
      "[notifications] markEntityNotificationsRead",
      notificationsError.message,
    );
    return { error: "No se pudieron buscar las notificaciones relacionadas.", markedCount: 0 };
  }

  const candidateIds = (notifications ?? [])
    .filter((row) => {
      if (reportId && row.report_id !== reportId) return false;
      if (documentId && row.document_id !== documentId) return false;
      if (audience === "client" && companyId && row.company_id !== companyId) {
        return false;
      }
      return true;
    })
    .map((row) => row.id);

  if (!candidateIds.length) {
    return { error: null, markedCount: 0 };
  }

  const { data: existingReads } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in("notification_id", candidateIds);

  const readSet = new Set((existingReads ?? []).map((row) => row.notification_id));
  const unreadIds = candidateIds.filter((id) => !readSet.has(id));

  const { error } = await upsertNotificationReads(supabase, userId, unreadIds);
  return { error, markedCount: unreadIds.length };
}
