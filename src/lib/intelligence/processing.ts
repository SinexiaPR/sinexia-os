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
import { createHash } from "crypto";
import { after } from "next/server";

const DOCUMENTS_BUCKET = "documents";

export type ReportProcessingSource = {
  id: string;
  company_id: string;
  title: string;
  period: string;
  file_url: string;
  category: string;
};

function logProcessing(event: string, meta: Record<string, unknown>) {
  console.info(`[sinexia-intelligence] ${event}`, meta);
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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
  force?: boolean;
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
    force = false,
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
    const contentHash = hashBuffer(buffer);

    if (buffer.byteLength > INTELLIGENCE_LIMITS.maxFileBytes) {
      throw new Error(
        `File exceeds intelligence limit of ${INTELLIGENCE_LIMITS.maxFileBytes} bytes`,
      );
    }

    // Reuse structured profile when identical file content was already processed
    if (!force) {
      const { data: currentRow } = await admin
        .from("document_processing")
        .select("id, status, content_hash")
        .eq("id", processingId)
        .maybeSingle();

      if (
        currentRow?.status === "completed" &&
        currentRow.content_hash &&
        currentRow.content_hash === contentHash
      ) {
        logProcessing("skip_identical_hash", {
          ...sourceMeta,
          processingId,
          contentHash,
        });
        return { ok: true, status: "completed" };
      }

      const { data: twin } = await admin
        .from("document_processing")
        .select("id")
        .eq("company_id", companyId)
        .eq("content_hash", contentHash)
        .eq("status", "completed")
        .neq("id", processingId)
        .limit(1)
        .maybeSingle();

      if (twin?.id) {
        const { data: twinProfile } = await admin
          .from("document_profiles")
          .select("*")
          .eq("document_processing_id", twin.id)
          .maybeSingle();

        if (twinProfile?.structured_data) {
          await admin
            .from("document_processing")
            .update({
              status: "completed",
              content_hash: contentHash,
              detected_document_type: twinProfile.document_type,
              detected_period: twinProfile.period,
              structured_summary: {
                documentType: twinProfile.document_type,
                briefSummary: twinProfile.summary,
                confidence: twinProfile.extraction_confidence,
                mainTotals: {},
                entities: {},
                warnings: ["Reused structured profile from identical file."],
                companyName: null,
                reportPeriod: twinProfile.period,
                documentDate: null,
                currency: null,
                sourceSystem: "profile_reuse",
              },
              processing_error: null,
              processed_at: new Date().toISOString(),
              is_analyzable: true,
            })
            .eq("id", processingId);

          await upsertDocumentProfile({
            admin,
            processingId,
            companyId,
            reportId: sourceMeta.reportId,
            documentId: sourceMeta.documentId,
            profile: {
              documentType: twinProfile.document_type ?? "accounts_receivable",
              period: twinProfile.period,
              structuredData: twinProfile.structured_data as Record<
                string,
                unknown
              >,
              summary:
                twinProfile.summary ??
                "Perfil reutilizado (archivo idéntico).",
              confidence: Number(twinProfile.extraction_confidence ?? 0.8),
            },
          });

          logProcessing("reuse_identical_profile", {
            ...sourceMeta,
            processingId,
            from: twin.id,
            contentHash,
          });
          return { ok: true, status: "completed" };
        }
      }
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
          processing_error: "Este documento requiere OCR para ser analizado por SinexIA.",
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
      buffer,
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
        currency:
          (typeof profile.structuredData.currency === "string"
            ? profile.structuredData.currency
            : null) ?? classification.summary.currency,
        source_system:
          (typeof profile.structuredData.source_system === "string"
            ? profile.structuredData.source_system
            : null) ?? classification.summary.sourceSystem,
        original_filename: filename,
        content_hash: contentHash,
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
  } else {
    return { ok: false, error: "Missing report or document id" };
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

export async function resolveReportForProcessing(
  reportId: string,
  source?: ReportProcessingSource | null,
  companyId?: string | null,
): Promise<
  | { ok: true; report: ReportProcessingSource; lookup: string }
  | { ok: false; error: string; lookup: string }
> {
  const normalizedReportId = reportId.trim();
  if (!normalizedReportId) {
    return { ok: false, error: "Report not found", lookup: "empty_report_id" };
  }

  if (
    source?.id === normalizedReportId &&
    source.file_url &&
    (!companyId || source.company_id === companyId)
  ) {
    return { ok: true, report: source, lookup: "snapshot" };
  }

  let adminLookupError: string | null = null;

  try {
    const admin = createAdminClient();
    let query = admin
      .from("reports")
      .select("id, company_id, title, period, file_url, category")
      .eq("id", normalizedReportId);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.maybeSingle();

    if (data) {
      return {
        ok: true,
        report: data as ReportProcessingSource,
        lookup: "service_role",
      };
    }

    adminLookupError = error?.message ?? "No row returned";
  } catch (error) {
    adminLookupError =
      error instanceof Error ? error.message : "Admin client unavailable";
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    let query = supabase
      .from("reports")
      .select("id, company_id, title, period, file_url, category")
      .eq("id", normalizedReportId);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.maybeSingle();

    if (data) {
      return {
        ok: true,
        report: data as ReportProcessingSource,
        lookup: "authenticated_admin",
      };
    }

    if (error) {
      logServerError("resolveReportForProcessing", error, {
        reportId: normalizedReportId,
        companyId,
        adminLookupError,
      });
    }
  } catch (error) {
    logServerError("resolveReportForProcessing authed", error, {
      reportId: normalizedReportId,
      companyId,
    });
  }

  logProcessing("report_lookup_failed", {
    reportId: normalizedReportId,
    companyId: companyId ?? null,
    adminLookupError,
  });

  return {
    ok: false,
    error: "Report not found",
    lookup: adminLookupError ?? "not_found",
  };
}

export async function bootstrapReportProcessing(
  source: ReportProcessingSource,
  supabase?: SupabaseClient,
): Promise<{ ok: boolean; processingId?: string; error?: string }> {
  const filename = source.file_url.split("/").pop() ?? "file";

  try {
    const admin = createAdminClient();
    const ensured = await ensureProcessingRow({
      admin,
      companyId: source.company_id,
      reportId: source.id,
      filename,
      force: false,
    });

    if (ensured.ok) {
      return { ok: true, processingId: ensured.processingId };
    }

    return { ok: false, error: ensured.error };
  } catch (error) {
    if (!supabase) {
      logServerError("bootstrapReportProcessing", error, {
        reportId: source.id,
      });
      return { ok: false, error: "Could not create processing record" };
    }
  }

  const fileFormat = getFileExtension(filename) || null;
  const analyzable = isAnalyzableFilename(filename);

  const { data: existing } = await supabase
    .from("document_processing")
    .select("id")
    .eq("report_id", source.id)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, processingId: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("document_processing")
    .insert({
      report_id: source.id,
      company_id: source.company_id,
      status: "pending",
      file_format: fileFormat,
      is_analyzable: analyzable,
      original_filename: filename,
      prompt_version: INTELLIGENCE_PROMPT_VERSION,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    logServerError("bootstrapReportProcessing authed", insertError, {
      reportId: source.id,
    });
    return { ok: false, error: "Could not create processing record" };
  }

  return { ok: true, processingId: inserted.id };
}

async function markProcessingFailure(
  admin: SupabaseClient,
  params: {
    reportId?: string;
    processingId?: string;
    error: string;
  },
): Promise<void> {
  let query = admin.from("document_processing").update({
    status: "failed",
    processing_error: params.error,
    processed_at: new Date().toISOString(),
  });

  if (params.processingId) {
    query = query.eq("id", params.processingId);
  } else if (params.reportId) {
    query = query.eq("report_id", params.reportId);
  } else {
    return;
  }

  await query;
}

export async function queueReportProcessing(
  source: ReportProcessingSource,
  supabase: SupabaseClient,
  force = false,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const fileExtension = getFileExtension(source.file_url.split("/").pop() ?? "");
  const bootstrap = await bootstrapReportProcessing(source, supabase);

  logProcessing("queue_report_processing", {
    reportId: source.id,
    companyId: source.company_id,
    processingId: bootstrap.processingId ?? null,
    fileExtension,
    lookupResult: bootstrap.ok ? "bootstrap_ok" : bootstrap.error ?? "bootstrap_failed",
  });

  const result = await processReportDocument({
    reportId: source.id,
    force,
    source,
    processingId: bootstrap.processingId,
  });

  logProcessing("queue_report_finished", {
    reportId: source.id,
    companyId: source.company_id,
    processingId: bootstrap.processingId ?? null,
    fileExtension,
    lookupResult: "snapshot",
    finalStatus: result.status ?? null,
    ok: result.ok,
    error: result.error ?? null,
  });

  return result;
}

export async function processReportDocument(options: {
  reportId: string;
  force?: boolean;
  source?: ReportProcessingSource;
  processingId?: string;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { reportId, force = false, source, processingId: knownProcessingId } =
    options;
  const fileExtension = getFileExtension(
    source?.file_url.split("/").pop() ?? "",
  );
  let admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    logServerError("Intelligence admin client", error, { reportId });
    return { ok: false, error: "Service role not configured" };
  }

  const resolved = await resolveReportForProcessing(
    reportId,
    source,
    source?.company_id,
  );

  logProcessing("process_report_lookup", {
    reportId,
    companyId:
      source?.company_id ??
      (resolved.ok ? resolved.report.company_id : null),
    processingId: knownProcessingId ?? null,
    fileExtension,
    lookupResult: resolved.lookup,
    found: resolved.ok,
  });

  if (!resolved.ok) {
    await markProcessingFailure(admin, {
      reportId,
      processingId: knownProcessingId,
      error: resolved.error,
    });
    return { ok: false, error: resolved.error };
  }

  const report = resolved.report;
  const filename = report.file_url.split("/").pop() ?? "file";
  const ensured = await ensureProcessingRow({
    admin,
    companyId: report.company_id,
    reportId: report.id,
    filename,
    force,
  });

  if (!ensured.ok) {
    await markProcessingFailure(admin, {
      reportId: report.id,
      processingId: knownProcessingId,
      error: ensured.error,
    });
    return ensured;
  }

  if (ensured.skip) {
    logProcessing("skip_existing", {
      reportId: report.id,
      processingId: ensured.processingId,
      status: ensured.skip,
    });
    return { ok: true, status: ensured.skip };
  }

  logProcessing("process_report_start", {
    reportId: report.id,
    companyId: report.company_id,
    processingId: ensured.processingId,
    fileExtension: getFileExtension(filename),
    lookupResult: resolved.lookup,
  });

  const pipelineResult = await runPipeline({
    admin,
    companyId: report.company_id,
    processingId: ensured.processingId,
    storageBucket: REPORTS_BUCKET,
    storagePath: report.file_url,
    filename,
    titleHint: report.title,
    fallbackPeriod: report.period,
    reportCategory: report.category,
    force,
    sourceMeta: { reportId: report.id },
  });

  logProcessing("process_report_finished", {
    reportId: report.id,
    companyId: report.company_id,
    processingId: ensured.processingId,
    fileExtension: getFileExtension(filename),
    finalStatus: pipelineResult.status ?? null,
    ok: pipelineResult.ok,
    error: pipelineResult.error ?? null,
  });

  return pipelineResult;
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
    force,
    sourceMeta: { documentId },
  });
}

export function scheduleReportProcessing(
  reportId: string,
  force = false,
  source?: ReportProcessingSource,
): void {
  after(async () => {
    try {
      const result = await processReportDocument({ reportId, force, source });
      logProcessing("scheduled_report_finished", {
        reportId,
        ok: result.ok,
        status: result.status,
        error: result.error ?? null,
        usedSource: Boolean(source),
      });
    } catch (error) {
      logServerError("scheduleReportProcessing", error, { reportId });
    }
  });
}

export function scheduleInboxDocumentProcessing(
  documentId: string,
  force = false,
): void {
  after(async () => {
    try {
      const result = await processInboxDocument({ documentId, force });
      logProcessing("scheduled_inbox_finished", {
        documentId,
        ok: result.ok,
        status: result.status,
        error: result.error ?? null,
      });
    } catch (error) {
      logServerError("scheduleInboxDocumentProcessing", error, {
        documentId,
      });
    }
  });
}
