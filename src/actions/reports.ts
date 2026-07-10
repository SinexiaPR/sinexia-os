"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import {
  isAllowedUploadFile,
  resolveUploadContentType,
  UPLOAD_MAX_BYTES,
} from "@/lib/constants/upload";
import {
  isReportCategory,
  REPORTS_BUCKET,
} from "@/lib/constants/reports";
import { logServerError } from "@/lib/errors/action-error";
import {
  reportError,
  reportSuccess,
  validationError,
} from "@/lib/reports/report-action-helpers";
import { createClient } from "@/lib/supabase/server";
import type { ReportActionState } from "@/types/reports";

export async function createReport(
  _prevState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const profile = await requireAdmin();

  try {
    const companyId = String(formData.get("company_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const period = String(formData.get("period") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const file = formData.get("file");

    if (!companyId) {
      return validationError("Missing company_id.");
    }

    if (!title) {
      return validationError("Missing title.");
    }

    if (!category) {
      return validationError("Missing category.");
    }

    if (!period) {
      return validationError("Missing period.");
    }

    if (!isReportCategory(category)) {
      return validationError(`Invalid report category: ${category}`);
    }

    if (!(file instanceof File) || file.size === 0) {
      return validationError("A report file is required.");
    }

    if (file.size > UPLOAD_MAX_BYTES) {
      return validationError("File exceeds the 50 MB limit.");
    }

    if (!isAllowedUploadFile(file)) {
      return validationError(
        "Unsupported file type. Use PDF, Excel, Word, or image.",
      );
    }

    const supabase = await createClient();
    const reportId = crypto.randomUUID();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${companyId}/${reportId}/${sanitizedName}`;
    const contentType = resolveUploadContentType(file);
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return reportError(uploadError, "Report storage upload", {
        bucket: REPORTS_BUCKET,
        storagePath,
        companyId,
        reportId,
      });
    }

    const { error: insertError } = await supabase.from("reports").insert({
      id: reportId,
      company_id: companyId,
      uploaded_by: profile.id,
      title,
      category,
      period,
      notes: notesRaw || null,
      file_url: storagePath,
    });

    if (insertError) {
      const { error: cleanupError } = await supabase.storage
        .from(REPORTS_BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        logServerError("Report storage cleanup after insert failure", cleanupError, {
          bucket: REPORTS_BUCKET,
          storagePath,
          reportId,
        });
      }

      return reportError(insertError, "Database insert failed", {
        reportId,
        companyId,
        uploadedBy: profile.id,
        category,
      });
    }

    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard");

    return reportSuccess();
  } catch (error) {
    return reportError(error, "Create report");
  }
}

export async function deleteReport(reportId: string) {
  await requireAdmin();

  const supabase = await createClient();

  const { data: report, error: fetchError } = await supabase
    .from("reports")
    .select("file_url")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError || !report) {
    return { error: "Report not found." };
  }

  const { error: deleteError } = await supabase
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteError) {
    return { error: "Failed to delete report." };
  }

  await supabase.storage.from(REPORTS_BUCKET).remove([report.file_url]);

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");

  return { success: true };
}
