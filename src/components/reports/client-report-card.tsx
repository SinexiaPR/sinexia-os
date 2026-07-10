import Link from "next/link";

import {
  ClientReportActions,
  ReportNewBadge,
} from "@/components/reports/client-report-actions";
import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { SurfaceCard } from "@/components/ui/surface-card";
import { STATUS_LABELS } from "@/lib/intelligence/constants";
import type { DocumentProfileRow } from "@/lib/intelligence/profiles/types";
import type {
  DetectedDocumentType,
  DocumentProcessingStatus,
  StructuredSummary,
} from "@/lib/intelligence/types";
import { getSignedReportFileUrl } from "@/services/reports";
import type { ReportWithCompany } from "@/types";
import { cn } from "@/lib/utils";

type ClientProcessingInfo = {
  status: DocumentProcessingStatus;
  detected_document_type: DetectedDocumentType | null;
  detected_period: string | null;
  structured_summary: StructuredSummary | null;
  processing_error: string | null;
};

type ClientReportCardProps = {
  report: ReportWithCompany;
  processing?: ClientProcessingInfo | null;
  profile?: DocumentProfileRow | null;
  profileId: string;
  isUnread?: boolean;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function arSuggestions(reportId: string): Array<{ label: string; href: string }> {
  const q = (text: string) =>
    `/dashboard/sia?reportId=${reportId}&q=${encodeURIComponent(text)}`;
  return [
    {
      label: "¿Cuál es mi total por cobrar?",
      href: q("¿Cuál es mi total por cobrar?"),
    },
    { label: "¿Quién debe más?", href: q("¿Quién debe más?") },
    {
      label: "¿Cuántas facturas hay?",
      href: q("¿Cuántas facturas hay?"),
    },
    {
      label: "Comparar con el reporte anterior",
      href: q("Comparar con el reporte anterior"),
    },
  ];
}

export async function ClientReportCard({
  report,
  processing,
  profile,
  profileId,
  isUnread = false,
}: ClientReportCardProps) {
  const signedUrl = await getSignedReportFileUrl(report.file_url);
  const status = processing?.status;
  const statusLabel = status ? (STATUS_LABELS[status] ?? status) : null;
  const brief =
    status === "completed"
      ? profile?.summary ?? processing?.structured_summary?.briefSummary
      : null;
  const isAR =
    profile?.document_type === "accounts_receivable" ||
    processing?.detected_document_type === "accounts_receivable" ||
    report.category === "Aging";
  const suggestions =
    status === "completed" && isAR ? arSuggestions(report.id) : [];

  return (
    <div id={`report-${report.id}`}>
      <SurfaceCard padding="lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ReportCategoryDisplay category={report.category} variant="client" />
            <ReportNewBadge show={isUnread} />
          </div>
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

          {statusLabel ? (
            <p className="pt-2 text-sm text-muted-foreground">
              SinexIA:{" "}
              <span
                className={cn(
                  "font-medium",
                  status === "completed" && "text-emerald-700",
                  status === "failed" && "text-red-700",
                  status === "requires_ocr" && "text-amber-700",
                )}
              >
                {statusLabel}
              </span>
            </p>
          ) : null}

          {status === "requires_ocr" ? (
            <p className="text-sm text-amber-800">
              Este documento requiere OCR para ser analizado por SinexIA.
            </p>
          ) : null}

          {brief ? (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Resumen
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {brief}
              </p>
            </div>
          ) : null}

          {suggestions.length ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preguntas sugeridas
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <ClientReportActions
          reportId={report.id}
          profileId={profileId}
          signedUrl={signedUrl}
          isUnread={isUnread}
        />
      </div>
      </SurfaceCard>
    </div>
  );
}
