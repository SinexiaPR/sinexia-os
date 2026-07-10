import { INTELLIGENCE_LIMITS, INTELLIGENCE_PROMPT_VERSION } from "@/lib/intelligence/constants";
import { classifyDocument } from "@/lib/intelligence/classification";
import { embedChunks } from "@/lib/intelligence/embeddings";
import {
  extractDocument,
  getFileExtension,
  isAnalyzableFilename,
} from "@/lib/intelligence/extraction";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORTS_BUCKET } from "@/lib/constants/reports";
import { logServerError } from "@/lib/errors/action-error";

type ProcessReportOptions = {
  reportId: string;
  force?: boolean;
};

function logProcessing(
  event: string,
  meta: Record<string, unknown>,
) {
  console.info(`[sinexia-intelligence] ${event}`, meta);
}

/**
 * Process a published report for SinexIA (extract → classify → embed).
 * Uses service-role client. Safe to call fire-and-forget after upload.
 */
export async function processReportDocument(
  options: ProcessReportOptions,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { reportId, force = false } = options;
  let admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    logServerError("Intelligence admin client", error, { reportId });
    return { ok: false, error: "Service role not configured" };
  }

  const { data: report, error: reportError } = await admin
    .from("reports")
    .select("id, company_id, title, period, file_url, category")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError || !report) {
    return { ok: false, error: "Report not found" };
  }

  const filename = report.file_url.split("/").pop() ?? "file";
  const analyzable = isAnalyzableFilename(filename);
  const fileFormat = getFileExtension(filename) || null;

  // Existing processing row?
  const { data: existing } = await admin
    .from("document_processing")
    .select("id, status")
    .eq("report_id", reportId)
    .maybeSingle();

  if (
    existing &&
    !force &&
    (existing.status === "completed" ||
      existing.status === "processing" ||
      existing.status === "requires_ocr")
  ) {
    logProcessing("skip_existing", {
      reportId,
      status: existing.status,
    });
    return { ok: true, status: existing.status };
  }

  let processingId = existing?.id as string | undefined;

  if (!processingId) {
    const { data: inserted, error: insertError } = await admin
      .from("document_processing")
      .insert({
        report_id: reportId,
        company_id: report.company_id,
        status: "pending",
        file_format: fileFormat,
        is_analyzable: analyzable,
        prompt_version: INTELLIGENCE_PROMPT_VERSION,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      logServerError("Create document_processing", insertError, { reportId });
      return { ok: false, error: "Failed to create processing record" };
    }
    processingId = inserted.id;
  }

  if (!analyzable) {
    await admin
      .from("document_processing")
      .update({
        status: "failed",
        is_analyzable: false,
        file_format: fileFormat,
        processing_error:
          "Formato no analizable. El archivo original sigue disponible para descarga.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", processingId);

    logProcessing("not_analyzable", { reportId, fileFormat });
    return { ok: true, status: "failed" };
  }

  await admin
    .from("document_processing")
    .update({
      status: "processing",
      processing_error: null,
      is_analyzable: true,
      file_format: fileFormat,
      updated_at: new Date().toISOString(),
    })
    .eq("id", processingId);

  logProcessing("start", { reportId, processingId, fileFormat });

  try {
    const { data: fileData, error: downloadError } = await admin.storage
      .from(REPORTS_BUCKET)
      .download(report.file_url);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Download failed");
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength > INTELLIGENCE_LIMITS.maxFileBytes) {
      throw new Error(
        `File exceeds intelligence limit of ${INTELLIGENCE_LIMITS.maxFileBytes} bytes`,
      );
    }

    const extraction = await extractDocument(buffer, filename);

    if (extraction.requiresOcr) {
      await admin
        .from("document_processing")
        .update({
          status: "requires_ocr",
          extracted_text: null,
          structured_summary: {
            warnings: [
              "Documento sin texto extraíble. Se requiere OCR (pendiente).",
            ],
            briefSummary: "Requiere OCR",
            confidence: 0,
          },
          processing_error: "Requiere OCR",
          processed_at: new Date().toISOString(),
          prompt_version: INTELLIGENCE_PROMPT_VERSION,
        })
        .eq("id", processingId);

      // Clear any old chunks
      await admin
        .from("document_chunks")
        .delete()
        .eq("document_processing_id", processingId);

      logProcessing("requires_ocr", { reportId, processingId });
      return { ok: true, status: "requires_ocr" };
    }

    const classification = await classifyDocument({
      filename: `${report.title}.${fileFormat}`,
      extractedText: extraction.text,
    });

    // Prefer admin-entered period if AI period is null
    const detectedPeriod =
      classification.summary.reportPeriod || report.period || null;

    const { chunks: embeddedChunks, tokenUsage: embedTokens } =
      await embedChunks(extraction.chunks);

    // Replace chunks
    await admin
      .from("document_chunks")
      .delete()
      .eq("document_processing_id", processingId);

    if (embeddedChunks.length) {
      const rows = embeddedChunks.map((chunk, index) => ({
        document_processing_id: processingId,
        company_id: report.company_id,
        content: chunk.content,
        page_number: chunk.pageNumber,
        sheet_name: chunk.sheetName,
        row_reference: chunk.rowReference,
        chunk_index: index,
        embedding: chunk.embedding,
      }));

      const { error: chunkError } = await admin
        .from("document_chunks")
        .insert(rows);

      if (chunkError) {
        throw new Error(`Chunk insert failed: ${chunkError.message}`);
      }
    }

    const totalTokens =
      (classification.tokenUsage ?? 0) + (embedTokens ?? 0);

    await admin
      .from("document_processing")
      .update({
        status: "completed",
        detected_document_type: classification.summary.documentType,
        detected_period: detectedPeriod,
        extracted_text: extraction.text.slice(
          0,
          INTELLIGENCE_LIMITS.maxExtractedTextChars,
        ),
        structured_summary: classification.summary,
        processing_error: null,
        model_name: classification.model,
        prompt_version: INTELLIGENCE_PROMPT_VERSION,
        token_usage: {
          classification: classification.tokenUsage,
          embeddings: embedTokens,
          total: totalTokens,
        },
        processed_at: new Date().toISOString(),
        file_format: fileFormat,
        is_analyzable: true,
      })
      .eq("id", processingId);

    logProcessing("completed", {
      reportId,
      processingId,
      chunks: embeddedChunks.length,
      tokens: totalTokens,
      type: classification.summary.documentType,
    });

    return { ok: true, status: "completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Processing failed";

    await admin
      .from("document_processing")
      .update({
        status: "failed",
        processing_error: message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", processingId);

    logServerError("processReportDocument", error, {
      reportId,
      processingId,
    });

    return { ok: false, status: "failed", error: message };
  }
}

export function scheduleReportProcessing(
  reportId: string,
  force = false,
): void {
  // Fire-and-forget; do not block upload response
  void processReportDocument({ reportId, force }).catch((error) => {
    logServerError("scheduleReportProcessing", error, { reportId });
  });
}
