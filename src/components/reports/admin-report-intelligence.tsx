"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  correctProcessingClassification,
  reprocessReport,
} from "@/actions/intelligence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DETECTED_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/intelligence/constants";
import type { DocumentProfileRow } from "@/lib/intelligence/profiles/types";
import type {
  DetectedDocumentType,
  DocumentProcessingStatus,
  StructuredSummary,
} from "@/lib/intelligence/types";
import { cn } from "@/lib/utils";

export type AdminProcessingInfo = {
  id: string;
  status: DocumentProcessingStatus;
  detected_document_type: DetectedDocumentType | null;
  detected_period: string | null;
  processing_error: string | null;
  structured_summary: StructuredSummary | null;
  processed_at: string | null;
};

type AdminReportIntelligenceProps = {
  reportId: string;
  processing: AdminProcessingInfo | null;
  profile?: DocumentProfileRow | null;
};

const TYPE_OPTIONS: DetectedDocumentType[] = [
  "payroll",
  "accounts_receivable",
  "accounts_payable",
  "custom_aging",
  "bank_reconciliation",
  "statement",
  "homebase_export",
  "quickbooks_report",
  "profit_and_loss",
  "balance_sheet",
  "bank_statement",
  "invoice",
  "purchase_order",
  "other",
];

export function AdminReportIntelligence({
  reportId,
  processing,
  profile,
}: AdminReportIntelligenceProps) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [docType, setDocType] = useState<DetectedDocumentType>(
    processing?.detected_document_type ?? "other",
  );
  const [period, setPeriod] = useState(processing?.detected_period ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const status = processing?.status ?? "pending";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const summaryText =
    profile?.summary ?? processing?.structured_summary?.briefSummary ?? null;
  const confidence =
    profile?.extraction_confidence ??
    processing?.structured_summary?.confidence ??
    null;

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          SinexIA:{" "}
          <span
            className={cn(
              "font-medium",
              status === "completed" && "text-emerald-700",
              status === "failed" && "text-red-700",
              status === "requires_ocr" && "text-amber-700",
              status === "processing" && "text-primary",
            )}
          >
            {statusLabel}
          </span>
        </span>
        {processing?.detected_document_type ? (
          <span>
            Tipo:{" "}
            {DETECTED_TYPE_LABELS[processing.detected_document_type] ??
              processing.detected_document_type}
          </span>
        ) : null}
        {processing?.detected_period ? (
          <span>Periodo detectado: {processing.detected_period}</span>
        ) : null}
        {confidence != null ? (
          <span>
            Confianza: {Math.round(confidence * 100)}%
          </span>
        ) : null}
      </div>

      {processing?.processing_error ? (
        <p className="text-xs text-red-700">{processing.processing_error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await reprocessReport(reportId);
              setMessage(
                result.error
                  ? result.error
                  : `Procesamiento: ${result.status ?? "ok"}`,
              );
            });
          }}
        >
          Reprocess
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAnalysis((v) => !v)}
        >
          {showAnalysis ? "Ocultar análisis" : "Ver análisis"}
        </Button>
        <Link
          href={`/api/reports/${reportId}/download`}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-primary hover:bg-muted/50"
        >
          Archivo fuente
        </Link>
      </div>

      {showAnalysis ? (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
          <p className="text-muted-foreground">
            {summaryText ?? "Sin resumen automático todavía."}
          </p>

          {profile?.structured_data &&
          Object.keys(profile.structured_data).length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                Datos estructurados
              </p>
              <dl className="grid gap-1 text-xs sm:grid-cols-2">
                {Object.entries(profile.structured_data)
                  .filter(([key]) => key !== "source_document")
                  .slice(0, 12)
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-muted-foreground">{key}:</dt>
                      <dd className="font-medium text-foreground">
                        {value == null ? "—" : String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setShowJson((v) => !v)}
          >
            {showJson ? "Ocultar JSON" : "JSON Viewer"}
          </Button>

          {showJson && profile?.structured_data ? (
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed text-foreground">
              {JSON.stringify(profile.structured_data, null, 2)}
            </pre>
          ) : null}

          {processing?.structured_summary?.warnings?.length ? (
            <ul className="list-disc pl-4 text-xs text-amber-800">
              {processing.structured_summary.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">
                Corregir tipo (solo clasificación)
              </span>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={docType}
                onChange={(e) =>
                  setDocType(e.target.value as DetectedDocumentType)
                }
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {DETECTED_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">
                Corregir periodo detectado
              </span>
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ej. Semana 12 / 2026-03"
                className="h-9"
              />
            </label>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !period.trim()}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                const result = await correctProcessingClassification({
                  reportId,
                  detectedDocumentType: docType,
                  detectedPeriod: period,
                });
                setMessage(
                  result.error
                    ? result.error
                    : "Clasificación actualizada.",
                );
              });
            }}
          >
            Guardar corrección
          </Button>
        </div>
      ) : null}

      {message ? (
        <p className="text-xs text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}
