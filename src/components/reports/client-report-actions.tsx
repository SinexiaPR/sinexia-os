"use client";

import { ReportViewLink } from "@/components/reports/report-view-link";
import { addLocalViewedReport } from "@/hooks/use-unread-reports";
import { cn } from "@/lib/utils";

type ClientReportActionsProps = {
  reportId: string;
  profileId: string;
  signedUrl: string | null;
  isUnread: boolean;
};

export function ReportNewBadge({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
      Nuevo
    </span>
  );
}

export function ClientReportActions({
  reportId,
  profileId,
  signedUrl,
  isUnread,
}: ClientReportActionsProps) {
  function markLocalViewed() {
    addLocalViewedReport(profileId, reportId);
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
      {signedUrl ? (
        <>
          <ReportViewLink
            reportId={reportId}
            href={signedUrl}
            onViewed={markLocalViewed}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border px-5 text-sm font-medium text-primary sm:min-w-[140px]"
          >
            Ver reporte
          </ReportViewLink>
          <ReportViewLink
            reportId={reportId}
            href={signedUrl}
            download
            onViewed={markLocalViewed}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground sm:min-w-[140px]"
          >
            Descargar
          </ReportViewLink>
        </>
      ) : (
        <span className="inline-flex h-11 w-full items-center justify-center text-sm text-muted-foreground sm:w-auto">
          No disponible
        </span>
      )}
      <ReportViewLink
        reportId={reportId}
        href={`/dashboard/sia?reportId=${reportId}`}
        onViewed={markLocalViewed}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/30 px-5 text-sm font-medium text-primary hover:bg-primary/5 sm:min-w-[140px]",
          isUnread && "ring-1 ring-red-500/20",
        )}
      >
        Preguntar a SinexIA
      </ReportViewLink>
    </div>
  );
}

/** SinexIA link only — for cards without download URLs */
export function ClientReportSiaLink({
  reportId,
  profileId,
}: {
  reportId: string;
  profileId: string;
}) {
  return (
    <ReportViewLink
      reportId={reportId}
      href={`/dashboard/sia?reportId=${reportId}`}
      onViewed={() => addLocalViewedReport(profileId, reportId)}
      className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/30 px-5 text-sm font-medium text-primary hover:bg-primary/5 sm:min-w-[140px]"
    >
      Preguntar a SinexIA
    </ReportViewLink>
  );
}
