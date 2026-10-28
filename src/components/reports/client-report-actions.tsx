"use client";

import { Download, Eye, Sparkles } from "lucide-react";

import { ReportViewLink } from "@/components/reports/report-view-link";
import { StatusBadge } from "@/components/ui/status-badge";
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
  return <StatusBadge tone="danger">Nuevo</StatusBadge>;
}

const baseButton =
  "focus-visible:ring-ring inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none";

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
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {signedUrl ? (
        <>
          <ReportViewLink
            reportId={reportId}
            href={signedUrl}
            onViewed={markLocalViewed}
            className={cn(baseButton, "bg-primary text-primary-foreground")}
          >
            <Eye aria-hidden className="size-4" />
            Ver reporte
          </ReportViewLink>
          <ReportViewLink
            reportId={reportId}
            href={signedUrl}
            download
            onViewed={markLocalViewed}
            className={cn(baseButton, "border-border border")}
          >
            <Download aria-hidden className="size-4" />
            Descargar
          </ReportViewLink>
        </>
      ) : (
        <span className="text-muted-foreground inline-flex h-11 items-center text-sm">
          Archivo no disponible
        </span>
      )}
      <ReportViewLink
        reportId={reportId}
        href={`/dashboard/sia?reportId=${reportId}`}
        onViewed={markLocalViewed}
        className={cn(
          baseButton,
          "border-primary/30 text-primary hover:bg-primary/5 border",
          isUnread && "ring-1 ring-red-500/20",
        )}
      >
        <Sparkles aria-hidden className="size-4" />
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
      className={cn(
        baseButton,
        "border-primary/30 text-primary hover:bg-primary/5 border",
      )}
    >
      <Sparkles aria-hidden className="size-4" />
      Preguntar a SinexIA
    </ReportViewLink>
  );
}
