import { getRecentDocuments } from "@/services/documents";
import { getRecentReports } from "@/services/reports";
import { DOCUMENT_STATUS_LABELS } from "@/types";
import { getDocumentDisplayType } from "@/lib/documents/upload-metadata";

export type AdminActivityKind =
  "document_received" | "document_processed" | "report_published";

export type AdminActivityItem = {
  id: string;
  kind: AdminActivityKind;
  title: string;
  description: string;
  timestamp: string;
  href: string;
};

function documentActivity(
  doc: Awaited<ReturnType<typeof getRecentDocuments>>[number],
): AdminActivityItem {
  const companyName = doc.company?.name ?? "Unknown company";

  if (doc.status === "processed") {
    return {
      id: `doc-processed-${doc.id}`,
      kind: "document_processed",
      title: "Document processed",
      description: `${getDocumentDisplayType(doc)} · ${companyName}`,
      timestamp: doc.created_at,
      href: "/dashboard/inbox",
    };
  }

  return {
    id: `doc-received-${doc.id}`,
    kind: "document_received",
    title: "New document received",
    description: `${getDocumentDisplayType(doc)} · ${companyName} · ${DOCUMENT_STATUS_LABELS[doc.status]}`,
    timestamp: doc.created_at,
    href: "/dashboard/inbox",
  };
}

export async function getAdminRecentActivity(
  limit = 8,
): Promise<AdminActivityItem[]> {
  const [recentDocuments, recentReports] = await Promise.all([
    getRecentDocuments(limit),
    getRecentReports(limit),
  ]);

  const documentItems = recentDocuments.map(documentActivity);

  const reportItems: AdminActivityItem[] = recentReports.map((report) => ({
    id: `report-${report.id}`,
    kind: "report_published",
    title: "Report published",
    description: `${report.title} · ${report.company?.name ?? "Unknown company"}`,
    timestamp: report.created_at,
    href: "/dashboard/reports",
  }));

  return [...documentItems, ...reportItems]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}
