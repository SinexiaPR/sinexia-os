"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireAuth } from "@/lib/auth/session";
import { ALL_DETECTED_TYPES } from "@/lib/intelligence/constants";
import type { DetectedDocumentType } from "@/lib/intelligence/types";
import type { ReportProcessingSource } from "@/lib/intelligence/processing";
import {
  processReportDocument,
  scheduleReportProcessing,
} from "@/lib/intelligence/processing";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set<DetectedDocumentType>([...ALL_DETECTED_TYPES]);

export async function reprocessReport(reportId: string) {
  await requireAdmin();

  const normalizedReportId = reportId.trim();
  if (!normalizedReportId) {
    return { error: "Missing report id." };
  }

  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, company_id, title, period, file_url, category")
    .eq("id", normalizedReportId)
    .maybeSingle();

  console.info("[sinexia-processing] reprocess_lookup", {
    reportId: normalizedReportId,
    companyId: report?.company_id ?? null,
    lookupResult: report ? "authenticated_admin" : error?.message ?? "not_found",
  });

  if (error || !report) {
    return { error: "Report not found." };
  }

  const result = await processReportDocument({
    reportId: normalizedReportId,
    force: true,
    source: report as ReportProcessingSource,
  });

  revalidatePath("/dashboard/reports");

  if (!result.ok) {
    return { error: result.error ?? "Processing failed." };
  }

  return { success: true, status: result.status };
}

export async function enqueueReportProcessing(reportId: string) {
  await requireAdmin();

  const normalizedReportId = reportId.trim();
  if (!normalizedReportId) {
    return { error: "Missing report id." };
  }

  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, company_id, title, period, file_url, category")
    .eq("id", normalizedReportId)
    .maybeSingle();

  if (error || !report) {
    return { error: "Report not found." };
  }

  scheduleReportProcessing(normalizedReportId, false, report as ReportProcessingSource);
  return { success: true };
}

export async function correctProcessingClassification(params: {
  reportId: string;
  detectedDocumentType: DetectedDocumentType;
  detectedPeriod: string;
}) {
  await requireAdmin();

  if (!ALLOWED_TYPES.has(params.detectedDocumentType)) {
    return { error: "Invalid document type." };
  }

  const period = params.detectedPeriod.trim();
  if (!period) {
    return { error: "Period is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_processing")
    .update({
      detected_document_type: params.detectedDocumentType,
      detected_period: period,
    })
    .eq("report_id", params.reportId);

  if (error) {
    return { error: "Failed to update classification." };
  }

  revalidatePath("/dashboard/reports");
  return { success: true };
}

export async function getReportProcessingStatus(reportId: string) {
  const profile = await requireAuth();

  const supabase = await createClient();
  let query = supabase
    .from("document_processing")
    .select(
      "id, status, detected_document_type, detected_period, processing_error, structured_summary, processed_at",
    )
    .eq("report_id", reportId);

  if (profile.role === "client") {
    if (!profile.company_id) {
      return { error: "Unauthorized" };
    }
    query = query.eq("company_id", profile.company_id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { error: "Failed to load status." };
  }

  return { data };
}
