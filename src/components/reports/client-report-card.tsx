import Link from "next/link";

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
    { label: "What is my total receivable?", href: q("What is my total receivable?") },
    { label: "Who owes the most?", href: q("Who owes the most?") },
    { label: "How many invoices exist?", href: q("How many invoices exist?") },
    { label: "Compare with previous report.", href: q("Compare with previous report.") },
  ];
}

export async function ClientReportCard({
  report,
  processing,
  profile,
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
              Requiere OCR — este PDF no tiene texto extraíble. El archivo
              original sigue disponible para descarga.
            </p>
          ) : null}

          {brief ? (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Summary
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {brief}
              </p>
            </div>
          ) : null}

          {suggestions.length ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested questions
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

        <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
          {signedUrl ? (
            <>
              <Link
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border px-5 text-sm font-medium text-primary sm:min-w-[140px]"
              >
                Original Report
              </Link>
              <Link
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground sm:min-w-[140px]"
              >
                Descargar
              </Link>
            </>
          ) : (
            <span className="inline-flex h-11 w-full items-center justify-center text-sm text-muted-foreground sm:w-auto">
              No disponible
            </span>
          )}
          <Link
            href={`/dashboard/sia?reportId=${report.id}`}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/30 px-5 text-sm font-medium text-primary hover:bg-primary/5 sm:min-w-[140px]"
          >
            Ask SinexIA
          </Link>
        </div>
      </div>
    </SurfaceCard>
  );
}
