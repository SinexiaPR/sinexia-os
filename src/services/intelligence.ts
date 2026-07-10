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
  report_date: string | null;
  currency: string | null;
  source_system: string | null;
  original_filename: string | null;
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
      "id, report_id, document_id, status, detected_document_type, detected_period, report_date, structured_summary, processed_at, reports(id, title, category, period, created_at), documents(id, supplier, invoice_number, document_type)",
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
    detected_period?: string | null;
    structured_summary?: StructuredSummary | null;
    reports?: { title?: string } | null;
  }>,
): string[] {
  if (!docs.length) {
    return [
      "¿Qué documentos tengo analizados?",
      "Resumime el último reporte disponible.",
    ];
  }

  const types = new Set(
    docs.map((d) => d.detected_document_type).filter(Boolean),
  );
  const suggestions: string[] = [];

  if (types.has("accounts_receivable") || types.has("custom_aging")) {
    suggestions.push(
      "How much is currently outstanding?",
      "Which customers owe more than 60 days?",
      "Which invoices expire this week?",
      "Compare this aging with last week's.",
      "Which customers owe the most?",
    );
  }

  if (types.has("accounts_payable")) {
    suggestions.push(
      "Which vendors represent the largest payments?",
      "What invoices should be paid first?",
      "Compare this AP aging with the previous report.",
    );
  }

  if (types.has("payroll") || types.has("homebase_export")) {
    suggestions.push(
      "How much payroll did I pay this month?",
      "Who worked the most overtime?",
      "Compare payroll with previous week.",
      "Summarize this payroll.",
    );
  }

  if (types.has("profit_and_loss") || types.has("balance_sheet")) {
    suggestions.push(
      "Summarize this financial report.",
      "What changed compared to the previous report?",
    );
  }

  if (types.has("invoice") || types.has("purchase_order")) {
    suggestions.push(
      "Resumime esta factura.",
      "¿Cuál es el monto y la fecha de vencimiento?",
    );
  }

  // Always include comparison / change prompts when ≥2 docs
  if (docs.length >= 2) {
    suggestions.push(
      "What changed since the previous upload?",
      "What trends appear across the latest documents?",
    );
  }

  suggestions.push(
    "Resumime este reporte.",
    "¿Qué información relevante debería revisar?",
  );

  return [...new Set(suggestions)].slice(0, 10);
}
