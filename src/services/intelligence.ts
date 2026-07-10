import type {
  DetectedDocumentType,
  DocumentProcessingStatus,
  StructuredSummary,
} from "@/lib/intelligence/types";
import { createClient } from "@/lib/supabase/server";

export type DocumentProcessingRow = {
  id: string;
  report_id: string | null;
  document_id: string | null;
  company_id: string;
  status: DocumentProcessingStatus;
  detected_document_type: DetectedDocumentType | null;
  detected_period: string | null;
  extracted_text: string | null;
  structured_summary: StructuredSummary | null;
  processing_error: string | null;
  file_format: string | null;
  is_analyzable: boolean;
  model_name: string | null;
  prompt_version: string | null;
  token_usage: Record<string, number> | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getProcessingByReportIds(
  reportIds: string[],
): Promise<Map<string, DocumentProcessingRow>> {
  const map = new Map<string, DocumentProcessingRow>();
  if (!reportIds.length) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_processing")
    .select("*")
    .in("report_id", reportIds);

  if (error) {
    console.error("[intelligence] getProcessingByReportIds", error.message);
    return map;
  }

  for (const row of data ?? []) {
    if (row.report_id) {
      map.set(row.report_id, row as DocumentProcessingRow);
    }
  }

  return map;
}

export async function getProcessingByReportId(
  reportId: string,
): Promise<DocumentProcessingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_processing")
    .select("*")
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    console.error("[intelligence] getProcessingByReportId", error.message);
    return null;
  }

  return (data as DocumentProcessingRow) ?? null;
}

export async function getCompletedProcessingForCompany(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_processing")
    .select(
      "id, report_id, status, detected_document_type, detected_period, structured_summary, processed_at, reports(id, title, category, period, created_at)",
    )
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("processed_at", { ascending: false });

  if (error) {
    console.error(
      "[intelligence] getCompletedProcessingForCompany",
      error.message,
    );
    return [];
  }

  return data ?? [];
}

export function buildSuggestedQuestions(
  docs: Array<{
    detected_document_type: DetectedDocumentType | null;
  }>,
): string[] {
  const types = new Set(
    docs.map((d) => d.detected_document_type).filter(Boolean),
  );
  const suggestions: string[] = [
    "¿Qué documentos nuevos publicó Sinexia?",
    "Resumime este reporte.",
    "¿Qué tendencias aparecen en los últimos documentos?",
    "¿Qué información relevante debería revisar?",
  ];

  if (types.has("payroll")) {
    suggestions.unshift(
      "¿Cuál es el total de la nómina de esta semana?",
      "¿Qué empleado tuvo más horas?",
      "¿Quién tuvo horas extra?",
      "¿Cuánto se pagó en tips?",
      "Compará esta nómina con la semana anterior.",
    );
  }

  if (types.has("accounts_receivable") || types.has("custom_aging")) {
    suggestions.unshift(
      "¿Cuál es el total pendiente por cobrar?",
      "¿Qué clientes deben más?",
      "¿Qué facturas están vencidas?",
      "¿Qué cambió respecto del aging anterior?",
      "Resumime las cuentas por cobrar de esta semana.",
    );
  }

  if (types.has("accounts_payable")) {
    suggestions.unshift(
      "¿Qué facturas se recomienda pagar esta semana?",
      "¿Qué proveedores tienen balances pendientes?",
      "¿Qué pagos vencen primero?",
      "Compará este documento con el de la semana pasada.",
    );
  }

  return [...new Set(suggestions)].slice(0, 10);
}
