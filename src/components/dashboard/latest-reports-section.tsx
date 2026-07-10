"use client";

import Link from "next/link";
import { Download } from "lucide-react";

import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useIsReportViewed } from "@/hooks/use-unread-reports";
import { markReportViewed } from "@/lib/notifications/viewed-reports";
import { formatDateEs } from "@/lib/portal/format";
import { cn } from "@/lib/utils";
import type { ReportWithCompany } from "@/types";

type LatestReportsSectionProps = {
  reports: ReportWithCompany[];
  profileId: string;
  signedUrls: Record<string, string | null>;
};

function LatestReportRow({
  report,
  profileId,
  signedUrl,
}: {
  report: ReportWithCompany;
  profileId: string;
  signedUrl: string | null;
}) {
  const viewed = useIsReportViewed(profileId, report.id, report.created_at);
  const isNew = !viewed;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        isNew && "bg-navy-soft/20 -mx-2 rounded-xl px-2",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReportCategoryDisplay category={report.category} variant="client" />
          {isNew ? (
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">
              Nuevo
            </span>
          ) : null}
        </div>
        <p className="truncate font-medium text-foreground">{report.title}</p>
        <p className="text-sm text-muted-foreground">
          {report.period} · {formatDateEs(report.created_at)}
        </p>
      </div>
      {signedUrl ? (
        <Link
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markReportViewed(profileId, report.id)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-primary hover:bg-muted/50"
        >
          <Download className="size-4" />
          Descargar
        </Link>
      ) : null}
    </div>
  );
}

export function LatestReportsSection({
  reports,
  profileId,
  signedUrls,
}: LatestReportsSectionProps) {
  return (
    <SurfaceCard padding="md">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          Últimos reportes
        </h2>
        <Link
          href="/dashboard/reports"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todos
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Aún no hay reportes publicados para su empresa.
        </p>
      ) : (
        <div>
          {reports.map((report) => (
            <LatestReportRow
              key={report.id}
              report={report}
              profileId={profileId}
              signedUrl={signedUrls[report.id] ?? null}
            />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
