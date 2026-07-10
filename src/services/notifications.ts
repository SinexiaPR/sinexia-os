import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export type PortalNotification = {
  id: string;
  kind: string;
  title: string;
  description: string;
  href: string;
  companyId: string | null;
  reportId: string | null;
  documentId: string | null;
  createdAt: string;
  read: boolean;
  companyName?: string | null;
};

export async function getNotificationsForUser(params: {
  userId: string;
  role: UserRole;
  companyId?: string | null;
  limit?: number;
}): Promise<PortalNotification[]> {
  const supabase = await createClient();
  const audience = params.role === "admin" ? "admin" : "client";
  const limit = params.limit ?? 20;

  let query = supabase
    .from("notifications")
    .select(
      "id, kind, title, description, href, company_id, report_id, document_id, created_at, companies(name)",
    )
    .eq("audience", audience)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (audience === "client" && params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  const [{ data, error }, { data: reads }] = await Promise.all([
    query,
    supabase
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", params.userId),
  ]);

  if (error) {
    console.error("[notifications] getNotificationsForUser", error.message);
    return [];
  }

  const readSet = new Set((reads ?? []).map((r) => r.notification_id));

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    href: row.href,
    companyId: row.company_id,
    reportId: row.report_id,
    documentId: row.document_id,
    createdAt: row.created_at,
    read: readSet.has(row.id),
    companyName: (row.companies as { name?: string } | null)?.name ?? null,
  }));
}

export async function countUnreadNotifications(params: {
  userId: string;
  role: UserRole;
  companyId?: string | null;
}): Promise<number> {
  const items = await getNotificationsForUser({
    ...params,
    limit: 50,
  });
  return items.filter((n) => !n.read).length;
}

export async function getViewedReportIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_views")
    .select("report_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[notifications] getViewedReportIds", error.message);
    return [];
  }

  return (data ?? []).map((row) => row.report_id);
}

export async function countUnreadReportsForUser(params: {
  userId: string;
  companyId: string;
}): Promise<number> {
  const supabase = await createClient();

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id")
    .eq("company_id", params.companyId);

  if (reportsError || !reports?.length) return 0;

  const viewed = await getViewedReportIds(params.userId);
  const viewedSet = new Set(viewed);

  return reports.filter((r) => !viewedSet.has(r.id)).length;
}
