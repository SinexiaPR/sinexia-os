import Link from "next/link";

import { DeleteReportButton } from "@/components/reports/delete-report-button";
import {
  AdminReportIntelligence,
  type AdminProcessingInfo,
} from "@/components/reports/admin-report-intelligence";
import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { ReportViewLink } from "@/components/reports/report-view-link";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getSignedReportFileUrl } from "@/services/reports";
import type { DocumentProfileRow } from "@/lib/intelligence/profiles/types";
import type { ReportWithCompany } from "@/types";

type AdminReportsListProps = {
  reports: ReportWithCompany[];
  processingByReportId: Map<string, AdminProcessingInfo>;
  profilesByReportId?: Map<string, DocumentProfileRow>;
  viewedReportIds?: string[];
  showFileMetadata?: boolean;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

async function AdminReportRow({
  report,
  processing,
  profile,
  isViewed,
  showFileMetadata,
}: {
  report: ReportWithCompany;
  processing: AdminProcessingInfo | null;
  profile: DocumentProfileRow | null;
  isViewed?: boolean;
  showFileMetadata?: boolean;
}) {
  const signedUrl = await getSignedReportFileUrl(report.file_url);

  return (
    <SurfaceCard padding="md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-foreground font-medium">{report.title}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>{report.company?.name ?? "—"}</span>
            <span aria-hidden>·</span>
            <ReportCategoryDisplay
              category={report.category}
              variant="admin"
              className="[&_p]:text-muted-foreground inline-flex [&_p]:text-sm [&_p]:tracking-normal [&_p]:normal-case"
            />
            <span aria-hidden>·</span>
            <span>{report.period}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Published {formatDate(report.created_at)}
          </p>
          {showFileMetadata ? (
            <p className="text-muted-foreground text-xs">
              {report.file_url.split("/").pop() ?? "Archivo"} ·{" "}
              {report.file_url.split(".").pop()?.toUpperCase() ?? "—"} ·{" "}
              {isViewed ? "Visto" : "No visto"}
            </p>
          ) : null}
          {report.notes ? (
            <p className="text-muted-foreground pt-2 text-sm leading-relaxed">
              {report.notes}
            </p>
          ) : null}
          <AdminReportIntelligence
            reportId={report.id}
            processing={processing}
            profile={profile}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {signedUrl ? (
            showFileMetadata ? (
              <ReportViewLink
                reportId={report.id}
                href={signedUrl}
                download
                className="border-border text-primary hover:bg-muted/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium"
              >
                Descargar
              </ReportViewLink>
            ) : (
              <Link
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border text-primary hover:bg-muted/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium"
              >
                Download
              </Link>
            )
          ) : (
            <span className="text-muted-foreground text-sm">Unavailable</span>
          )}
          <DeleteReportButton reportId={report.id} />
        </div>
      </div>
    </SurfaceCard>
  );
}

export async function AdminReportsList({
  reports,
  processingByReportId,
  profilesByReportId,
  viewedReportIds = [],
  showFileMetadata = false,
}: AdminReportsListProps) {
  if (reports.length === 0) {
    return (
      <SurfaceCard padding="lg">
        <p className="text-muted-foreground py-8 text-center text-sm">
          No reports published yet.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <AdminReportRow
          key={report.id}
          report={report}
          processing={processingByReportId.get(report.id) ?? null}
          profile={profilesByReportId?.get(report.id) ?? null}
          isViewed={viewedReportIds.includes(report.id)}
          showFileMetadata={showFileMetadata}
        />
      ))}
    </div>
  );
}
