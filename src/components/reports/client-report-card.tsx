import Link from "next/link";

import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getSignedReportFileUrl } from "@/services/reports";
import type { ReportWithCompany } from "@/types";

type ClientReportCardProps = {
  report: ReportWithCompany;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export async function ClientReportCard({ report }: ClientReportCardProps) {
  const signedUrl = await getSignedReportFileUrl(report.file_url);

  return (
    <SurfaceCard padding="lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <ReportCategoryDisplay category={report.category} variant="client" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {report.title}
          </h2>
          <p className="text-sm text-muted-foreground">Periodo: {report.period}</p>
          <p className="text-sm text-muted-foreground">
            Publicado el {formatDate(report.created_at)}
          </p>
          {report.notes ? (
            <p className="border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">
              {report.notes}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          {signedUrl ? (
            <Link
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground sm:w-auto sm:min-w-[120px]"
            >
              Descargar
            </Link>
          ) : (
            <span className="inline-flex h-11 w-full items-center justify-center text-sm text-muted-foreground sm:w-auto">
              No disponible
            </span>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
