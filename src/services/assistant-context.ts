import type { Profile, Report } from "@/types";
import { PENDING_STATUSES } from "@/types";

import { getCompanyById, getDocumentsForCompany } from "@/services/documents";
import { getReportsForCompany } from "@/services/reports";
import type { AssistantContext } from "@/lib/assistant/types";

export async function buildAssistantContext(
  profile: Profile,
): Promise<AssistantContext> {
  if (!profile.company_id) {
    return {
      companyName: "su empresa",
      totalDocuments: 0,
      pendingDocuments: 0,
      availableReports: 0,
      latestReportTitle: null,
    };
  }

  const [company, documents, reports] = await Promise.all([
    getCompanyById(profile.company_id),
    getDocumentsForCompany(profile.company_id),
    getReportsForCompany(profile.company_id),
  ]);

  const pendingDocuments = documents.filter((doc) =>
    PENDING_STATUSES.includes(doc.status),
  ).length;

  const latestReport = getLatestReport(reports);

  return {
    companyName: company?.name ?? "su empresa",
    totalDocuments: documents.length,
    pendingDocuments,
    availableReports: reports.length,
    latestReportTitle: latestReport?.title ?? null,
  };
}

function getLatestReport(reports: Report[]): Report | null {
  if (reports.length === 0) {
    return null;
  }

  return [...reports].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}
