import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";
import type { DetectedDocumentType } from "@/lib/intelligence/types";

export async function upsertDocumentProfile(params: {
  admin: SupabaseClient;
  processingId: string;
  companyId: string;
  reportId?: string | null;
  documentId?: string | null;
  profile: ExtractionProfileResult;
}): Promise<void> {
  const { admin, processingId, companyId, reportId, documentId, profile } =
    params;

  const row = {
    document_processing_id: processingId,
    company_id: companyId,
    report_id: reportId ?? null,
    document_id: documentId ?? null,
    document_type: profile.documentType,
    period: profile.period,
    structured_data: profile.structuredData,
    summary: profile.summary,
    extraction_confidence: profile.confidence,
    source_document:
      typeof profile.structuredData.source_document === "string"
        ? profile.structuredData.source_document
        : null,
    upload_date:
      typeof profile.structuredData.upload_date === "string"
        ? profile.structuredData.upload_date
        : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("document_profiles")
    .upsert(row, { onConflict: "document_processing_id" });

  if (error) {
    throw new Error(`document_profiles upsert failed: ${error.message}`);
  }
}

export async function getProfilesForCompany(
  companyId: string,
  filters?: {
    reportId?: string | null;
    documentType?: DetectedDocumentType | null;
    period?: string | null;
    processingId?: string | null;
  },
) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  let query = supabase
    .from("document_profiles")
    .select(
      "*, document_processing!inner(id, status, report_id, document_id, processed_at, reports(id, title, category, period), documents(id, supplier, document_type))",
    )
    .eq("company_id", companyId)
    .eq("document_processing.status", "completed")
    .order("upload_date", { ascending: false });

  if (filters?.processingId) {
    query = query.eq("document_processing_id", filters.processingId);
  }
  if (filters?.reportId) {
    query = query.eq("report_id", filters.reportId);
  }
  if (filters?.documentType) {
    query = query.eq("document_type", filters.documentType);
  }
  if (filters?.period) {
    query = query.eq("period", filters.period);
  }

  const { data, error } = await query.limit(20);
  if (error) {
    console.error("[document_profiles]", error.message);
    return [];
  }
  return data ?? [];
}

export async function getProfileByProcessingId(processingId: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_profiles")
    .select("*")
    .eq("document_processing_id", processingId)
    .maybeSingle();
  return data;
}

export async function getDocumentHistory(companyId: string, limit = 12) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_profiles")
    .select(
      "id, document_type, period, summary, extraction_confidence, upload_date, report_id, document_id, structured_data, document_processing!inner(processed_at, reports(title, category), documents(supplier, document_type))",
    )
    .eq("company_id", companyId)
    .order("upload_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}
