import {
  INTELLIGENCE_LIMITS,
  INTELLIGENCE_PROMPT_VERSION,
} from "@/lib/intelligence/constants";
import {
  classifyDocument,
  detectDocumentTypeHeuristic,
} from "@/lib/intelligence/classification";
import { embedChunks } from "@/lib/intelligence/embeddings";
import {
  extractDocument,
  getFileExtension,
  isAnalyzableFilename,
} from "@/lib/intelligence/extraction";
import {
  profileToStructuredSummary,
  runSpecializedExtractor,
} from "@/lib/intelligence/extractors";
import { upsertDocumentProfile } from "@/lib/intelligence/profiles/store";
import { REPORT_CATEGORY_TO_TYPE } from "@/lib/intelligence/profiles/types";
import type { DetectedDocumentType } from "@/lib/intelligence/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORTS_BUCKET } from "@/lib/constants/reports";
import { logServerError } from "@/lib/errors/action-error";
import type { SupabaseClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET = "documents";

function logProcessing(event: string, meta: Record<string, unknown>) {
  console.info(`[sinexia-intelligence] ${event}`, meta);
}

const STRUCTURED_TYPES = new Set<DetectedDocumentType>([
  "payroll",
  "homebase_export",
  "accounts_receivable",
  "accounts_payable",
  "custom_aging",
  "profit_and_loss",
  "balance_sheet",
  "quickbooks_report",
  "bank_reconciliation",
  "bank_statement",
  "statement",
]);

function shouldSkipEmbeddings(
  documentType: DetectedDocumentType,
  profileConfidence: number,
): boolean {
  return profileConfidence >= 0.35 && STRUCTURED_TYPES.has(documentType);
}

function parseReportDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

async function runPipeline(params: {
  admin: SupabaseClient;
  companyId: string;
  processingId: string;
  storageBucket: string;
  storagePath: string;
  filename: string;
  titleHint: string;
  fallbackPeriod: string | null;
  reportCategory?: string | null;
  sourceMeta: { reportId?: string; documentId?: string };
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const {
    admin,
    companyId,
    processingId,
    storageBucket,
    storagePath,
    filename,
    titleHint,
    fallbackPeriod,
    reportCategory,
    sourceMeta,
  } = params;

  const fileFormat = getFileExtension(filename) || null;
  const analyzable = isAnalyzableFilename(filename);

  if (!analyzable) {
    await admin
      .from("document_processing")
      .update({
        status: "failed",
        is_analyzable: false,
        file_format: fileFormat,
        original_filename: filename,
        processing_error:
          "Formato no analizable. El archivo original sigue disponible para descarga.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", processingId);

    logProcessing("not_analyzable", { ...sourceMeta, fileFormat });
    return { ok: true, status: "failed" };
  }

  await admin
    .from("document_processing")
    .update({
      status: "processing",
      processing_error: null,
      is_analyzable: true,
      file_format: fileFormat,
      original_filename: filename,
      updated_at: new Date().toISOString(),
    })
    .eq("id", processingId);

  logProcessing("start", { ...sourceMeta, processingId, fileFormat });

  try {
    const { data: fileData, error: downloadError } = await admin.storage
      .from(storageBucket)
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Download failed");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

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
          original_filename: filename,
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

      await admin
        .from("document_chunks")
        .delete()
        .eq("document_processing_id", processingId);

      logProcessing("requires_ocr", { ...sourceMeta, processingId });
      return { ok: true, status: "requires_ocr" };
    }

    const uploadDate = new Date().toISOString();
    const heuristicType =
      (reportCategory && REPORT_CATEGORY_TO_TYPE[reportCategory]) ||
      detectDocumentTypeHeuristic(filename, extraction.text);

    const profile = runSpecializedExtractor({
      documentType: heuristicType,
      extraction,
      filename,
      titleHint,
      fallbackPeriod,
      uploadDate,
      reportCategory,
    });

    const skipGptClassification =
      Boolean(reportCategory) || profile.confidence >= 0.35;

    const classification = skipGptClassification
      ? {
          summary: profileToStructuredSummary(profile, heuristicType),
          model: null,
          tokenUsage: 0,
        }
      : await classifyDocument({
          filename: `${titleHint}.${fileFormat}`,
          extractedText: extraction.text,
        });

    const detectedPeriod =
      profile.period ||
      classification.summary.reportPeriod ||
      fallbackPeriod ||
      null;
    const reportDate = parseReportDate(
      classification.summary.documentDate ?? detectedPeriod,
    );

    const skipEmbeddings = shouldSkipEmbeddings(
      profile.documentType,
      profile.confidence,
    );

    let embedTokens = 0;
    let embeddedChunks: Awaited<ReturnType<typeof embedChunks>>["chunks"] = [];

    await admin
      .from("document_chunks")
      .delete()
      .eq("document_processing_id", processingId);

    if (!skipEmbeddings) {
      const embedded = await embedChunks(extraction.chunks);
      embeddedChunks = embedded.chunks;
      embedTokens = embedded.tokenUsage ?? 0;

      if (embeddedChunks.length) {
        const rows = embeddedChunks.map((chunk, index) => ({
          document_processing_id: processingId,
          company_id: companyId,
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
    }

    await upsertDocumentProfile({
      admin,
      processingId,
      companyId,
      reportId: sourceMeta.reportId ?? null,
      documentId: sourceMeta.documentId ?? null,
      profile: {
        ...profile,
        period: detectedPeriod,
        structuredData: {
          ...profile.structuredData,
          period: detectedPeriod,
        },
      },
    });

    const totalTokens =
      (classification.tokenUsage ?? 0) + (embedTokens ?? 0);

    await admin
      .from("document_processing")
      .update({
        status: "completed",
        detected_document_type: profile.documentType ?? classification.summary.documentType,
        detected_period: detectedPeriod,
        report_date: reportDate,
        currency: classification.summary.currency,
        source_system: classification.summary.sourceSystem,
        original_filename: filename,
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
      ...sourceMeta,
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

    logServerError("runPipeline", error, { ...sourceMeta, processingId });
    return { ok: false, status: "failed", error: message };
  }
}

async function ensureProcessingRow(params: {
  admin: SupabaseClient;
  companyId: string;
  reportId?: string | null;
  documentId?: string | null;
  filename: string;
  force: boolean;
}): Promise<
  | { ok: true; processingId: string; skip?: string }
  | { ok: false; error: string }
> {
  const { admin, companyId, reportId, documentId, filename, force } = params;
  const fileFormat = getFileExtension(filename) || null;
  const analyzable = isAnalyzableFilename(filename);

  let existingQuery = admin
    .from("document_processing")
    .select("id, status");

  if (reportId) {
    existingQuery = existingQuery.eq("report_id", reportId);
  } else if (documentId) {
    existingQuery = existingQuery.eq("document_id", documentId);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (
    existing &&
    !force &&
    (existing.status === "completed" ||
      existing.status === "processing" ||
      existing.status === "requires_ocr")
  ) {
    return { ok: true, processingId: existing.id, skip: existing.status };
  }

  if (existing?.id) {
    return { ok: true, processingId: existing.id };
  }

  const { data: inserted, error: insertError } = await admin
    .from("document_processing")
    .insert({
      report_id: reportId ?? null,
      document_id: documentId ?? null,
      company_id: companyId,
      status: "pending",
      file_format: fileFormat,
      is_analyzable: analyzable,
      original_filename: filename,
      prompt_version: INTELLIGENCE_PROMPT_VERSION,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    logServerError("Create document_processing", insertError, {
      reportId,
      documentId,
    });
    return { ok: false, error: "Failed to create processing record" };
  }

  return { ok: true, processingId: inserted.id };
}

export async function processReportDocument(options: {
  reportId: string;
  force?: boolean;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
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
  const ensured = await ensureProcessingRow({
    admin,
    companyId: report.company_id,
    reportId,
    filename,
    force,
  });

  if (!ensured.ok) return ensured;
  if (ensured.skip) {
    logProcessing("skip_existing", { reportId, status: ensured.skip });
    return { ok: true, status: ensured.skip };
  }

  return runPipeline({
    admin,
    companyId: report.company_id,
    processingId: ensured.processingId,
    storageBucket: REPORTS_BUCKET,
    storagePath: report.file_url,
    filename,
    titleHint: report.title,
    fallbackPeriod: report.period,
    reportCategory: report.category,
    sourceMeta: { reportId },
  });
}

export async function processInboxDocument(options: {
  documentId: string;
  force?: boolean;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { documentId, force = false } = options;
  let admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    logServerError("Intelligence admin client", error, { documentId });
    return { ok: false, error: "Service role not configured" };
  }

  const { data: doc, error: docError } = await admin
    .from("documents")
    .select(
      "id, company_id, supplier, invoice_number, invoice_date, document_type, file_url",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !doc) {
    return { ok: false, error: "Document not found" };
  }

  const filename = doc.file_url.split("/").pop() ?? "file";
  const titleHint =
    `${doc.document_type} ${doc.supplier} ${doc.invoice_number}`.trim();

  const ensured = await ensureProcessingRow({
    admin,
    companyId: doc.company_id,
    documentId,
    filename,
    force,
  });

  if (!ensured.ok) return ensured;
  if (ensured.skip) {
    logProcessing("skip_existing", { documentId, status: ensured.skip });
    return { ok: true, status: ensured.skip };
  }

  return runPipeline({
    admin,
    companyId: doc.company_id,
    processingId: ensured.processingId,
    storageBucket: DOCUMENTS_BUCKET,
    storagePath: doc.file_url,
    filename,
    titleHint,
    fallbackPeriod: doc.invoice_date,
    sourceMeta: { documentId },
  });
}

export function scheduleReportProcessing(
  reportId: string,
  force = false,
): void {
  void processReportDocument({ reportId, force }).catch((error) => {
    logServerError("scheduleReportProcessing", error, { reportId });
  });
}

export function scheduleInboxDocumentProcessing(
  documentId: string,
  force = false,
): void {
  void processInboxDocument({ documentId, force }).catch((error) => {
    logServerError("scheduleInboxDocumentProcessing", error, {
      documentId,
    });
  });
}
