import type {
  DetectedDocumentType,
  DocumentProcessingStatus,
  StructuredSummary,
} from "@/lib/intelligence/types";
import type { DocumentProfileRow } from "@/lib/intelligence/profiles/types";
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

export async function getProfilesByReportIds(
  reportIds: string[],
): Promise<Map<string, DocumentProfileRow>> {
  const map = new Map<string, DocumentProfileRow>();
  if (!reportIds.length) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_profiles")
    .select("*")
    .in("report_id", reportIds);

  if (error) {
    console.error("[intelligence] getProfilesByReportIds", error.message);
    return map;
  }

  for (const row of data ?? []) {
    if (row.report_id) {
      map.set(row.report_id, row as DocumentProfileRow);
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

export async function getProfilesForCompanySuggestions(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_profiles")
    .select(
      "document_type, period, summary, structured_data, extraction_confidence, report_id, reports(title, category)",
    )
    .eq("company_id", companyId)
    .order("upload_date", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[intelligence] getProfilesForCompanySuggestions", error.message);
    return [];
  }

  return data ?? [];
}

export function buildSuggestedQuestionsFromProfiles(
  profiles: Array<{
    document_type: DetectedDocumentType | null;
    period?: string | null;
    structured_data?: Record<string, unknown> | null;
  }>,
): string[] {
  if (!profiles.length) {
    return [
      "¿Qué documentos tengo analizados?",
      "Resumime el último reporte disponible.",
    ];
  }

  const types = new Set(
    profiles.map((p) => p.document_type).filter(Boolean),
  );
  const suggestions: string[] = [];

  if (types.has("payroll") || types.has("homebase_export")) {
    suggestions.push(
      "What is the payroll total?",
      "How many employees?",
      "How many overtime hours?",
      "Compare payroll with previous week.",
    );
  }

  if (types.has("accounts_receivable") || types.has("custom_aging")) {
    suggestions.push(
      "Total receivables",
      "How many customers are in receivables?",
      "How many invoices?",
      "Compare with previous report",
    );
  }

  if (types.has("accounts_payable")) {
    suggestions.push(
      "Total payables",
      "How many vendors?",
      "Compare this AP aging with the previous report.",
    );
  }

  if (types.has("profit_and_loss") || types.has("quickbooks_report")) {
    suggestions.push(
      "What is revenue?",
      "What are expenses?",
      "What is net income?",
      "Summarize this financial report.",
    );
  }

  if (types.has("balance_sheet")) {
    suggestions.push(
      "What are total assets?",
      "What are liabilities?",
      "What is equity?",
    );
  }

  if (types.has("bank_reconciliation")) {
    suggestions.push(
      "What is the reconciliation difference?",
      "Compare with previous reconciliation.",
    );
  }

  if (types.has("bank_statement") || types.has("statement")) {
    suggestions.push(
      "What is the closing balance?",
      "Compare with previous statement.",
    );
  }

  if (profiles.length >= 2) {
    suggestions.push(
      "What changed since the previous upload?",
      "Compare the last two reports.",
    );
  }

  suggestions.push("Summarize this report.");

  return [...new Set(suggestions)].slice(0, 10);
}

/** @deprecated Use buildSuggestedQuestionsFromProfiles */
export function buildSuggestedQuestions(
  docs: Array<{
    detected_document_type: DetectedDocumentType | null;
    detected_period?: string | null;
    structured_summary?: StructuredSummary | null;
    reports?: { title?: string } | null;
  }>,
): string[] {
  return buildSuggestedQuestionsFromProfiles(
    docs.map((d) => ({
      document_type: d.detected_document_type,
      period: d.detected_period,
      structured_data: d.structured_summary?.mainTotals ?? null,
    })),
  );
}
