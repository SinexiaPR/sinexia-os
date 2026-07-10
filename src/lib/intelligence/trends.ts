import type {
  DetectedDocumentType,
  TrendPoint,
  TrendResult,
} from "@/lib/intelligence/types";
import { createClient } from "@/lib/supabase/server";

type ProcessingWithReport = {
  id: string;
  report_id: string | null;
  detected_document_type: DetectedDocumentType | null;
  detected_period: string | null;
  structured_summary: {
    mainTotals?: Record<string, number | string | null>;
    confidence?: number;
    briefSummary?: string;
  } | null;
  processed_at: string | null;
  reports: {
    id: string;
    title: string;
    period: string;
    category: string;
  } | null;
};

function pickNumericTotal(
  totals: Record<string, number | string | null> | undefined,
  keys: string[],
): { value: number | null; label: string } {
  if (!totals) return { value: null, label: keys[0] ?? "total" };

  for (const key of keys) {
    const found = Object.entries(totals).find(
      ([k]) => k.toLowerCase().includes(key.toLowerCase()),
    );
    if (!found) continue;
    const raw = found[1];
    const num =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(String(raw).replace(/[^0-9.-]/g, ""))
          : NaN;
    if (!Number.isNaN(num)) {
      return { value: num, label: found[0] };
    }
  }

  // First numeric value as fallback
  for (const [label, raw] of Object.entries(totals)) {
    const num =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(String(raw).replace(/[^0-9.-]/g, ""))
          : NaN;
    if (!Number.isNaN(num)) {
      return { value: num, label };
    }
  }

  return { value: null, label: keys[0] ?? "total" };
}

const METRIC_KEYS: Record<string, string[]> = {
  payroll_total: ["total", "payroll", "nómina", "nomina", "gross", "neto"],
  overtime: ["overtime", "extra", "horas extra"],
  tips: ["tips", "propina"],
  ar_total: ["total", "receivable", "cobrar", "balance", "outstanding"],
  ap_total: ["total", "payable", "pagar", "balance", "outstanding"],
};

export async function getTrendForCompany(params: {
  companyId: string;
  documentType: DetectedDocumentType;
  metric: keyof typeof METRIC_KEYS;
}): Promise<TrendResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_processing")
    .select(
      "id, report_id, detected_document_type, detected_period, structured_summary, processed_at, reports(id, title, period, category)",
    )
    .eq("company_id", params.companyId)
    .eq("status", "completed")
    .eq("detected_document_type", params.documentType)
    .order("processed_at", { ascending: true });

  if (error) {
    return {
      category: params.documentType,
      metric: params.metric,
      points: [],
      available: false,
      message: "No se pudo cargar la tendencia.",
      comparedDocuments: [],
    };
  }

  const rows = (data ?? []) as unknown as ProcessingWithReport[];
  const keys = METRIC_KEYS[params.metric] ?? ["total"];

  const points: TrendPoint[] = [];
  for (const row of rows) {
    const confidence = row.structured_summary?.confidence ?? 0;
    if (confidence < 0.35) continue;

    const { value, label } = pickNumericTotal(
      row.structured_summary?.mainTotals,
      keys,
    );

    if (value == null || !row.reports) continue;

    points.push({
      reportId: row.reports.id,
      title: row.reports.title,
      period: row.detected_period ?? row.reports.period,
      processedAt: row.processed_at,
      value,
      label,
    });
  }

  if (points.length < 2) {
    return {
      category: params.documentType,
      metric: params.metric,
      points,
      available: false,
      message:
        points.length === 1
          ? "Se necesita al menos otro documento comparable para mostrar una tendencia."
          : "Comparación no disponible: extracción insuficiente o un solo documento.",
      comparedDocuments: points.map((p) => ({
        reportId: p.reportId,
        title: p.title,
        period: p.period,
      })),
    };
  }

  return {
    category: params.documentType,
    metric: params.metric,
    points,
    available: true,
    message: null,
    comparedDocuments: points.map((p) => ({
      reportId: p.reportId,
      title: p.title,
      period: p.period,
    })),
  };
}

export async function getAvailableTrendSummaries(companyId: string) {
  const types: DetectedDocumentType[] = [
    "payroll",
    "accounts_receivable",
    "accounts_payable",
  ];

  const results: TrendResult[] = [];
  for (const documentType of types) {
    const metric =
      documentType === "payroll"
        ? "payroll_total"
        : documentType === "accounts_receivable"
          ? "ar_total"
          : "ap_total";
    results.push(
      await getTrendForCompany({ companyId, documentType, metric }),
    );
  }
  return results;
}
