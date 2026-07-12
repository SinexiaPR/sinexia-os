import { countPendingDocumentsForCompany } from "@/services/documents";
import { createClient } from "@/lib/supabase/server";
import type { ReportCategory } from "@/lib/constants/reports";
import { DOCUMENT_STATUS_LABELS, PENDING_STATUSES } from "@/types";
import { getDocumentDisplayType } from "@/lib/documents/upload-metadata";

export type ClientDashboardStats = {
  publishedReports: number;
  pendingDocuments: number;
  analyzedDocuments: number;
  lastReport: {
    id: string;
    title: string;
    category: ReportCategory;
    period: string;
    createdAt: string;
  } | null;
  lastUpdate: string | null;
};

export type ClientActivityKind =
  | "document_received"
  | "document_reviewing"
  | "document_processed"
  | "report_published"
  | "document_analyzed";

export type ClientActivityItem = {
  id: string;
  kind: ClientActivityKind;
  title: string;
  description: string;
  timestamp: string;
  href: string;
};

async function countPublishedReports(companyId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (error) throw error;
  return count ?? 0;
}

async function countAnalyzedDocuments(companyId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("document_processing")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "completed");

  if (error) throw error;
  return count ?? 0;
}

async function getLatestReport(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, title, category, period, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    category: data.category as ReportCategory,
    period: data.period,
    createdAt: data.created_at,
  };
}

async function resolveLastUpdate(companyId: string): Promise<string | null> {
  const supabase = await createClient();

  const [reportRes, documentRes, processingRes] = await Promise.all([
    supabase
      .from("reports")
      .select("created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("document_processing")
      .select("processed_at")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const timestamps = [
    reportRes.data?.created_at,
    documentRes.data?.created_at,
    processingRes.data?.processed_at,
  ].filter(Boolean) as string[];

  if (!timestamps.length) return null;

  return timestamps.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )[0];
}

function documentActivityItem(doc: {
  id: string;
  supplier: string;
  document_type: string;
  document_type_description?: string | null;
  status: string;
  created_at: string;
}): ClientActivityItem {
  if (doc.status === "processed") {
    return {
      id: `doc-processed-${doc.id}`,
      kind: "document_processed",
      title: "Documento procesado",
      description: getDocumentDisplayType(doc),
      timestamp: doc.created_at,
      href: "/dashboard/inbox",
    };
  }

  if (doc.status === "reviewing") {
    return {
      id: `doc-reviewing-${doc.id}`,
      kind: "document_reviewing",
      title: "Documento en revisión",
      description: `${getDocumentDisplayType(doc)} · ${DOCUMENT_STATUS_LABELS.reviewing}`,
      timestamp: doc.created_at,
      href: "/dashboard/inbox",
    };
  }

  return {
    id: `doc-received-${doc.id}`,
    kind: "document_received",
    title: "Documento subido",
    description: getDocumentDisplayType(doc),
    timestamp: doc.created_at,
    href: "/dashboard/inbox",
  };
}

export async function getClientDashboardStats(
  companyId: string,
): Promise<ClientDashboardStats> {
  const [
    publishedReports,
    pendingDocuments,
    analyzedDocuments,
    lastReport,
    lastUpdate,
  ] = await Promise.all([
    countPublishedReports(companyId),
    countPendingDocumentsForCompany(companyId),
    countAnalyzedDocuments(companyId),
    getLatestReport(companyId),
    resolveLastUpdate(companyId),
  ]);

  return {
    publishedReports,
    pendingDocuments,
    analyzedDocuments,
    lastReport,
    lastUpdate,
  };
}

export async function getClientRecentActivity(
  companyId: string,
  limit = 5,
): Promise<ClientActivityItem[]> {
  const supabase = await createClient();
  const fetchLimit = limit * 2;

  const [documentsRes, reportsRes, processingRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id, supplier, document_type, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
    supabase
      .from("reports")
      .select("id, title, category, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit),
    supabase
      .from("document_processing")
      .select(
        "id, processed_at, report_id, reports(title), documents(supplier, document_type)",
      )
      .eq("company_id", companyId)
      .eq("status", "completed")
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: false })
      .limit(fetchLimit),
  ]);

  if (documentsRes.error) throw documentsRes.error;
  if (reportsRes.error) throw reportsRes.error;
  if (processingRes.error) throw processingRes.error;

  const documentItems = (documentsRes.data ?? [])
    .filter(
      (doc) =>
        PENDING_STATUSES.includes(doc.status) || doc.status === "processed",
    )
    .map(documentActivityItem);

  const reportItems: ClientActivityItem[] = (reportsRes.data ?? []).map(
    (report) => ({
      id: `report-${report.id}`,
      kind: "report_published",
      title: "Reporte publicado",
      description: `${report.title} · ${report.category}`,
      timestamp: report.created_at,
      href: "/dashboard/reports",
    }),
  );

  const analyzedItems: ClientActivityItem[] = (processingRes.data ?? []).map(
    (row) => {
      const report = row.reports as { title?: string } | null;
      const document = row.documents as {
        supplier?: string;
        document_type?: string;
      } | null;
      const label =
        report?.title ??
        (document
          ? `${document.document_type} · ${document.supplier}`
          : "Documento");

      return {
        id: `analyzed-${row.id}`,
        kind: "document_analyzed",
        title: "Documento analizado por SinexIA",
        description: label,
        timestamp: row.processed_at as string,
        href: row.report_id ? "/dashboard/reports" : "/dashboard/inbox",
      };
    },
  );

  return [...documentItems, ...reportItems, ...analyzedItems]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}

export async function getClientDashboardData(companyId: string) {
  const [stats, activity] = await Promise.all([
    getClientDashboardStats(companyId),
    getClientRecentActivity(companyId, 5),
  ]);

  return { stats, activity };
}
