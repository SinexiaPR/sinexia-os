import Link from "next/link";

import {
  ClientReportActions,
  ReportNewBadge,
} from "@/components/reports/client-report-actions";
import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StatusBadge } from "@/components/ui/status-badge";
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

function arSuggestions(
  reportId: string,
): Array<{ label: string; href: string }> {
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
      ? (profile?.summary ?? processing?.structured_summary?.briefSummary)
      : null;
  const isAR =
    profile?.document_type === "accounts_receivable" ||
    processing?.detected_document_type === "accounts_receivable" ||
    report.category === "Aging";
  const suggestions =
    status === "completed" && isAR ? arSuggestions(report.id) : [];

  const hasDetails = Boolean(
    brief || suggestions.length || statusLabel || status === "requires_ocr",
  );
  const statusTone =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "requires_ocr"
          ? "warning"
          : "neutral";

  return (
    <div id={`report-${report.id}`} className="scroll-mt-20">
      <SurfaceCard padding="md" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ReportCategoryDisplay
              category={report.category}
              variant="client"
            />
            <ReportNewBadge show={isUnread} />
          </div>
          <p className="text-muted-foreground text-sm">
            Publicado el {formatDate(report.created_at)}
          </p>
        </div>

        <div className="space-y-1">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            {report.title}
          </h2>
          <p className="text-muted-foreground text-sm">
            Periodo: {report.period}
          </p>
          {report.notes ? (
            <p className="text-muted-foreground pt-1 text-sm leading-relaxed">
              {report.notes}
            </p>
          ) : null}
        </div>

        <ClientReportActions
          reportId={report.id}
          profileId={profileId}
          signedUrl={signedUrl}
          isUnread={isUnread}
        />

        {hasDetails ? (
          <Accordion
            type="single"
            collapsible
            className="border-border/70 rounded-md border"
          >
            <AccordionItem value="detalle" className="border-b-0">
              <AccordionTrigger className="min-h-11 px-4 text-sm">
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  Análisis de SinexIA
                  {statusLabel ? (
                    <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 px-4">
                {status === "requires_ocr" ? (
                  <p className="text-warning text-sm">
                    Este documento requiere OCR para ser analizado por SinexIA.
                  </p>
                ) : null}
                {brief ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Resumen
                    </p>
                    <p className="text-foreground/90 text-sm leading-relaxed">
                      {brief}
                    </p>
                  </div>
                ) : null}
                {suggestions.length ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Preguntas sugeridas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((suggestion) => (
                        <Link
                          key={suggestion.label}
                          href={suggestion.href}
                          className="border-border/80 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground focus-visible:ring-ring inline-flex min-h-10 items-center rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {suggestion.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
