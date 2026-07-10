import type {
  DocumentComparison,
  StructuredSummary,
} from "@/lib/intelligence/types";
import { createClient } from "@/lib/supabase/server";

type ComparableRow = {
  id: string;
  report_id: string | null;
  document_id: string | null;
  detected_document_type: string | null;
  detected_period: string | null;
  structured_summary: StructuredSummary | null;
  processed_at: string | null;
  reports: { id: string; title: string; period: string } | null;
  documents: {
    id: string;
    supplier: string;
    invoice_number: string;
    document_type: string;
  } | null;
};

function titleFor(row: ComparableRow): string {
  if (row.reports?.title) return row.reports.title;
  if (row.documents) {
    return `${row.documents.document_type} · ${row.documents.supplier} ${row.documents.invoice_number}`.trim();
  }
  return "Documento";
}

function entitySet(summary: StructuredSummary | null): Set<string> {
  const set = new Set<string>();
  if (!summary?.entities) return set;
  for (const key of [
    "customers",
    "vendors",
    "employees",
    "invoices",
  ] as const) {
    for (const item of summary.entities[key] ?? []) {
      set.add(`${key}:${item}`);
    }
  }
  return set;
}

function numericTotals(
  summary: StructuredSummary | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!summary?.mainTotals) return out;
  for (const [key, raw] of Object.entries(summary.mainTotals)) {
    const num =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(String(raw).replace(/[^0-9.-]/g, ""))
          : NaN;
    if (!Number.isNaN(num)) out[key] = num;
  }
  return out;
}

/**
 * Compare the two most recent completed documents of the same detected type
 * for a company. Optionally pin to a specific report/document as "current".
 */
export async function compareLatestDocuments(params: {
  companyId: string;
  documentType?: string | null;
  currentReportId?: string | null;
}): Promise<DocumentComparison> {
  const supabase = await createClient();

  let query = supabase
    .from("document_processing")
    .select(
      "id, report_id, document_id, detected_document_type, detected_period, structured_summary, processed_at, reports(id, title, period), documents(id, supplier, invoice_number, document_type)",
    )
    .eq("company_id", params.companyId)
    .eq("status", "completed")
    .order("processed_at", { ascending: false })
    .limit(20);

  if (params.documentType) {
    query = query.eq("detected_document_type", params.documentType);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    return {
      available: false,
      message: "No hay documentos analizados para comparar.",
      current: { title: "", period: null },
      previous: { title: "", period: null },
      totalDelta: {},
      newEntities: [],
      removedEntities: [],
      highlights: [],
    };
  }

  const rows = data as unknown as ComparableRow[];

  let current = rows[0];
  if (params.currentReportId) {
    current =
      rows.find((r) => r.report_id === params.currentReportId) ?? current;
  }

  const previous = rows.find(
    (r) =>
      r.id !== current.id &&
      (!params.documentType ||
        r.detected_document_type === current.detected_document_type),
  );

  if (!previous) {
    return {
      available: false,
      message:
        "Se necesita al menos otro documento comparable del mismo tipo.",
      current: {
        title: titleFor(current),
        period: current.detected_period ?? current.reports?.period ?? null,
        reportId: current.report_id ?? undefined,
      },
      previous: { title: "", period: null },
      totalDelta: {},
      newEntities: [],
      removedEntities: [],
      highlights: [],
    };
  }

  const curTotals = numericTotals(current.structured_summary);
  const prevTotals = numericTotals(previous.structured_summary);
  const keys = new Set([
    ...Object.keys(curTotals),
    ...Object.keys(prevTotals),
  ]);

  const totalDelta: DocumentComparison["totalDelta"] = {};
  const highlights: string[] = [];

  for (const key of keys) {
    const cur = curTotals[key] ?? null;
    const prev = prevTotals[key] ?? null;
    const change =
      cur != null && prev != null ? Number((cur - prev).toFixed(2)) : null;
    totalDelta[key] = { previous: prev, current: cur, change };
    if (change != null && Math.abs(change) > 0) {
      const direction = change > 0 ? "aumentó" : "disminuyó";
      highlights.push(
        `${key}: ${direction} ${Math.abs(change)} (${prev} → ${cur})`,
      );
    }
  }

  const curEntities = entitySet(current.structured_summary);
  const prevEntities = entitySet(previous.structured_summary);
  const newEntities = [...curEntities].filter((e) => !prevEntities.has(e));
  const removedEntities = [...prevEntities].filter(
    (e) => !curEntities.has(e),
  );

  if (newEntities.length) {
    highlights.push(
      `Nuevas entidades (${newEntities.length}): ${newEntities
        .slice(0, 8)
        .map((e) => e.split(":")[1])
        .join(", ")}`,
    );
  }
  if (removedEntities.length) {
    highlights.push(
      `Entidades removidas (${removedEntities.length}): ${removedEntities
        .slice(0, 8)
        .map((e) => e.split(":")[1])
        .join(", ")}`,
    );
  }

  const confidenceOk =
    (current.structured_summary?.confidence ?? 0) >= 0.35 &&
    (previous.structured_summary?.confidence ?? 0) >= 0.35;

  if (!confidenceOk && !highlights.length) {
    return {
      available: false,
      message:
        "Comparación no disponible: confianza de extracción insuficiente.",
      current: {
        title: titleFor(current),
        period: current.detected_period ?? current.reports?.period ?? null,
        reportId: current.report_id ?? undefined,
      },
      previous: {
        title: titleFor(previous),
        period:
          previous.detected_period ?? previous.reports?.period ?? null,
        reportId: previous.report_id ?? undefined,
      },
      totalDelta,
      newEntities,
      removedEntities,
      highlights: [],
    };
  }

  return {
    available: true,
    message: null,
    current: {
      title: titleFor(current),
      period: current.detected_period ?? current.reports?.period ?? null,
      reportId: current.report_id ?? undefined,
    },
    previous: {
      title: titleFor(previous),
      period: previous.detected_period ?? previous.reports?.period ?? null,
      reportId: previous.report_id ?? undefined,
    },
    totalDelta,
    newEntities,
    removedEntities,
    highlights: highlights.slice(0, 12),
  };
}

export function isComparisonIntent(question: string): boolean {
  return /compar|versus|vs\.?|anterior|previo|cambió|cambio|tendencia|trend|week\s*before|semana\s*pasada|last\s*week/i.test(
    question,
  );
}
