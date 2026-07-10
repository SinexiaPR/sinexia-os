import Link from "next/link";

import { DeleteReportButton } from "@/components/reports/delete-report-button";
import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getSignedReportFileUrl } from "@/services/reports";
import type { ReportWithCompany } from "@/types";

type AdminReportsListProps = {
  reports: ReportWithCompany[];
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

async function AdminReportRow({ report }: { report: ReportWithCompany }) {
  const signedUrl = await getSignedReportFileUrl(report.file_url);

  return (
    <SurfaceCard padding="md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">{report.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{report.company?.name ?? "—"}</span>
            <span aria-hidden>·</span>
            <ReportCategoryDisplay
              category={report.category}
              variant="admin"
              className="inline-flex [&_p]:normal-case [&_p]:text-sm [&_p]:text-muted-foreground [&_p]:tracking-normal"
            />
            <span aria-hidden>·</span>
            <span>{report.period}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Publicado el {formatDate(report.created_at)}
          </p>
          {report.notes ? (
            <p className="pt-2 text-sm leading-relaxed text-muted-foreground">
              {report.notes}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {signedUrl ? (
            <Link
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-xl border border-border px-3 text-sm font-medium text-primary hover:bg-muted/50"
            >
              Descargar
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">No disponible</span>
          )}
          <DeleteReportButton reportId={report.id} />
        </div>
      </div>
    </SurfaceCard>
  );
}

export async function AdminReportsList({ reports }: AdminReportsListProps) {
  if (reports.length === 0) {
    return (
      <SurfaceCard padding="lg">
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay reportes publicados.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <AdminReportRow key={report.id} report={report} />
      ))}
    </div>
  );
}
