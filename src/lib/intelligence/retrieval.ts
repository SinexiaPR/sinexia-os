import {
  CHAT_SYSTEM_PROMPT,
  CHAT_USER_TEMPLATE,
} from "@/lib/intelligence/prompts";
import {
  chatCompletion,
  createEmbeddings,
  isOpenAIConfigured,
} from "@/lib/intelligence/providers/openai";
import {
  compareLatestDocuments,
  isComparisonIntent,
} from "@/lib/intelligence/comparison";
import {
  buildGptCacheKey,
  getCachedGptResponse,
  setCachedGptResponse,
} from "@/lib/intelligence/gpt-cache";
import {
  detectQueryIntent,
  requiresOpenAI,
} from "@/lib/intelligence/intents";
import {
  answerFromStructuredQuery,
} from "@/lib/intelligence/query-engine";
import { getAvailableTrendSummaries } from "@/lib/intelligence/trends";
import type { SourceReference } from "@/lib/intelligence/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAssistantContext } from "@/services/assistant-context";

export type RetrievalFilters = {
  companyId: string;
  reportId?: string | null;
  category?: string | null;
  period?: string | null;
  processingId?: string | null;
  userId?: string;
};

export type RetrievedChunk = {
  id: string;
  document_processing_id: string;
  content: string;
  page_number: number | null;
  sheet_name: string | null;
  row_reference: string | null;
  similarity: number;
  report_id: string | null;
  document_id: string | null;
  title: string;
  period: string | null;
  detected_period: string | null;
  report_date: string | null;
  category: string | null;
};

type AnswerTier =
  | "structured"
  | "cached"
  | "chunks"
  | "summaries"
  | "pending"
  | "portal_metadata";

async function resolveAllowedProcessingIds(
  filters: RetrievalFilters,
): Promise<{ processingId: string | null; allowed: string[] | null }> {
  const supabase = await createClient();
  let processingId = filters.processingId ?? null;

  if (!filters.reportId && !filters.category && !filters.period) {
    return { processingId, allowed: null };
  }

  let query = supabase
    .from("document_processing")
    .select(
      "id, report_id, detected_period, status, reports(id, title, category, period, company_id)",
    )
    .eq("company_id", filters.companyId)
    .eq("status", "completed");

  if (filters.reportId) {
    query = query.eq("report_id", filters.reportId);
  }

  const { data: rows } = await query;
  const filtered = (rows ?? []).filter((row) => {
    const report = row.reports as unknown as {
      category?: string;
      period?: string;
    } | null;
    if (filters.category && report?.category !== filters.category) {
      return false;
    }
    if (filters.period) {
      const periodMatch =
        row.detected_period === filters.period ||
        report?.period === filters.period;
      if (!periodMatch) return false;
    }
    return true;
  });

  const allowed = filtered.map((r) => r.id);
  if (filters.reportId && filtered[0]) {
    processingId = filtered[0].id;
  }

  return { processingId, allowed: allowed.length ? allowed : [] };
}

export async function retrieveRelevantChunks(
  question: string,
  filters: RetrievalFilters,
  matchCount = 8,
): Promise<RetrievedChunk[]> {
  const supabase = await createClient();
  const { processingId, allowed: allowedProcessingIds } =
    await resolveAllowedProcessingIds(filters);

  if (allowedProcessingIds && !allowedProcessingIds.length) {
    return [];
  }

  if (isOpenAIConfigured()) {
    try {
      const { embeddings } = await createEmbeddings([question]);
      const embedding = embeddings[0];
      if (embedding) {
        const { data, error } = await supabase.rpc("match_document_chunks", {
          query_embedding: embedding,
          match_company_id: filters.companyId,
          match_count: matchCount,
          filter_processing_id: processingId,
        });

        if (!error && data?.length) {
          let matches = data as Array<{
            id: string;
            document_processing_id: string;
            content: string;
            page_number: number | null;
            sheet_name: string | null;
            row_reference: string | null;
            similarity: number;
          }>;

          if (allowedProcessingIds) {
            const allowed = new Set(allowedProcessingIds);
            matches = matches.filter((m) =>
              allowed.has(m.document_processing_id),
            );
          }

          return enrichChunks(matches, filters.companyId);
        }
      }
    } catch {
      // fall through
    }
  }

  let chunkQuery = supabase
    .from("document_chunks")
    .select(
      "id, document_processing_id, content, page_number, sheet_name, row_reference",
    )
    .eq("company_id", filters.companyId)
    .limit(40);

  if (processingId) {
    chunkQuery = chunkQuery.eq("document_processing_id", processingId);
  } else if (allowedProcessingIds) {
    chunkQuery = chunkQuery.in(
      "document_processing_id",
      allowedProcessingIds,
    );
  }

  const { data: chunks } = await chunkQuery;
  if (!chunks?.length) return [];

  const terms = question
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);

  const scored = chunks
    .map((c) => {
      const lower = c.content.toLowerCase();
      const score = terms.reduce(
        (acc, term) => acc + (lower.includes(term) ? 1 : 0),
        0,
      );
      return { ...c, similarity: score / Math.max(terms.length, 1) };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  return enrichChunks(scored, filters.companyId);
}

async function enrichChunks(
  matches: Array<{
    id: string;
    document_processing_id: string;
    content: string;
    page_number: number | null;
    sheet_name: string | null;
    row_reference: string | null;
    similarity: number;
  }>,
  companyId: string,
): Promise<RetrievedChunk[]> {
  if (!matches.length) return [];

  const supabase = await createClient();
  const processingIds = [
    ...new Set(matches.map((m) => m.document_processing_id)),
  ];

  const { data: processingRows } = await supabase
    .from("document_processing")
    .select(
      "id, detected_period, report_date, report_id, document_id, reports(id, title, category, period, company_id), documents(id, supplier, invoice_number, document_type)",
    )
    .eq("company_id", companyId)
    .in("id", processingIds);

  const byId = new Map((processingRows ?? []).map((row) => [row.id, row]));

  return matches.map((m) => {
    const proc = byId.get(m.document_processing_id);
    const report = proc?.reports as unknown as {
      id: string;
      title: string;
      category: string;
      period: string;
    } | null;
    const document = proc?.documents as unknown as {
      id: string;
      supplier: string;
      invoice_number: string;
      document_type: string;
    } | null;

    const title = report?.title
      ? report.title
      : document
        ? `${document.document_type} · ${document.supplier} ${document.invoice_number}`.trim()
        : "Documento";

    return {
      id: m.id,
      document_processing_id: m.document_processing_id,
      content: m.content,
      page_number: m.page_number,
      sheet_name: m.sheet_name,
      row_reference: m.row_reference,
      similarity: m.similarity,
      report_id: report?.id ?? proc?.report_id ?? null,
      document_id: document?.id ?? proc?.document_id ?? null,
      title,
      period: report?.period ?? null,
      detected_period: proc?.detected_period ?? null,
      report_date: proc?.report_date ?? null,
      category: report?.category ?? document?.document_type ?? null,
    };
  });
}

async function retrieveFromSummaries(
  question: string,
  filters: RetrievalFilters,
): Promise<RetrievedChunk[]> {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("document_profiles")
    .select(
      "id, document_processing_id, report_id, document_id, period, summary, structured_data, document_processing!inner(id, detected_period, report_date, status, reports(id, title, category, period), documents(id, supplier, invoice_number, document_type))",
    )
    .eq("company_id", filters.companyId)
    .eq("document_processing.status", "completed")
    .order("upload_date", { ascending: false })
    .limit(15);

  if (!profiles?.length) {
    const { data } = await supabase
      .from("document_processing")
      .select(
        "id, report_id, document_id, detected_period, report_date, structured_summary, extracted_text, reports(id, title, category, period), documents(id, supplier, invoice_number, document_type)",
      )
      .eq("company_id", filters.companyId)
      .eq("status", "completed")
      .order("processed_at", { ascending: false })
      .limit(15);

    if (!data?.length) return [];

    const terms = question
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3);

    const scored = data
      .map((row) => {
        const summary = row.structured_summary as {
          briefSummary?: string;
        } | null;
        const haystack = [
          summary?.briefSummary ?? "",
          (row.extracted_text ?? "").slice(0, 4000),
        ]
          .join("\n")
          .toLowerCase();
        const score = terms.reduce(
          (acc, term) => acc + (haystack.includes(term) ? 1 : 0),
          0.1,
        );
        return { row, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored.map(({ row, score }) => {
      const report = row.reports as unknown as {
        id: string;
        title: string;
        category: string;
        period: string;
      } | null;
      const document = row.documents as unknown as {
        id: string;
        supplier: string;
        invoice_number: string;
        document_type: string;
      } | null;
      const summary = row.structured_summary as {
        briefSummary?: string;
      } | null;

      return {
        id: row.id,
        document_processing_id: row.id,
        content:
          summary?.briefSummary ||
          (row.extracted_text ?? "").slice(0, 1200) ||
          "Documento analizado sin resumen.",
        page_number: null,
        sheet_name: null,
        row_reference: null,
        similarity: score,
        report_id: report?.id ?? row.report_id,
        document_id: document?.id ?? row.document_id,
        title: report?.title
          ? report.title
          : document
            ? `${document.document_type} · ${document.supplier}`
            : "Documento",
        period: report?.period ?? null,
        detected_period: row.detected_period,
        report_date: row.report_date,
        category: report?.category ?? document?.document_type ?? null,
      };
    });
  }

  const terms = question
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3);

  const scored = profiles
    .map((row) => {
      const haystack = [
        row.summary ?? "",
        JSON.stringify(row.structured_data ?? {}),
      ]
        .join("\n")
        .toLowerCase();
      const score = terms.reduce(
        (acc, term) => acc + (haystack.includes(term) ? 1 : 0),
        0.1,
      );
      return { row, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ row, score }) => {
    const proc = row.document_processing as unknown as {
      id: string;
      detected_period: string | null;
      report_date: string | null;
      reports?: { id: string; title: string; category: string; period: string };
      documents?: {
        id: string;
        supplier: string;
        invoice_number: string;
        document_type: string;
      };
    };
    const report = proc.reports;
    const document = proc.documents;

    return {
      id: row.document_processing_id,
      document_processing_id: row.document_processing_id,
      content: row.summary ?? "Documento analizado.",
      page_number: null,
      sheet_name: null,
      row_reference: null,
      similarity: score,
      report_id: row.report_id ?? report?.id ?? null,
      document_id: row.document_id ?? document?.id ?? null,
      title: report?.title
        ? report.title
        : document
          ? `${document.document_type} · ${document.supplier}`
          : "Documento",
      period: row.period ?? report?.period ?? null,
      detected_period: proc.detected_period,
      report_date: proc.report_date,
      category: report?.category ?? document?.document_type ?? null,
    };
  });
}

async function getPendingNotice(
  companyId: string,
): Promise<{ message: string; sources: SourceReference[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_processing")
    .select(
      "id, status, report_id, document_id, original_filename, reports(title), documents(supplier, document_type)",
    )
    .eq("company_id", companyId)
    .in("status", ["pending", "processing", "requires_ocr"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (!data?.length) return null;

  const lines = data.map((row) => {
    const report = row.reports as unknown as { title?: string } | null;
    const document = row.documents as unknown as {
      supplier?: string;
      document_type?: string;
    } | null;
    const title =
      report?.title ||
      (document
        ? `${document.document_type} · ${document.supplier}`
        : row.original_filename) ||
      "Documento";
    const status =
      row.status === "requires_ocr"
        ? "requiere OCR"
        : row.status === "processing"
          ? "en análisis"
          : "pendiente";
    return `• ${title} (${status})`;
  });

  return {
    message: `Todavía no hay suficiente contenido analizado para responder. Documentos en proceso:\n${lines.join("\n")}`,
    sources: data.map((row) => {
      const report = row.reports as unknown as { title?: string } | null;
      return {
        reportId: row.report_id ?? undefined,
        documentId: row.document_id ?? undefined,
        title:
          report?.title ||
          row.original_filename ||
          "Documento en proceso",
        period: null,
      };
    }),
  };
}

export function buildSourceReferences(
  chunks: RetrievedChunk[],
): SourceReference[] {
  const seen = new Set<string>();
  const refs: SourceReference[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.report_id ?? chunk.document_id}:${chunk.page_number}:${chunk.sheet_name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    refs.push({
      reportId: chunk.report_id ?? undefined,
      documentId: chunk.document_id ?? undefined,
      title: chunk.title,
      period: chunk.detected_period ?? chunk.period,
      reportDate: chunk.report_date,
      pageNumber: chunk.page_number,
      sheetName: chunk.sheet_name,
      viewPath: chunk.report_id
        ? `/dashboard/reports?highlight=${chunk.report_id}`
        : chunk.document_id
          ? `/dashboard/inbox`
          : undefined,
      downloadPath: chunk.report_id
        ? `/api/reports/${chunk.report_id}/download`
        : undefined,
    });
  }

  return refs;
}

function formatSourcesAppendix(sources: SourceReference[]): string {
  if (!sources.length) return "";
  const lines = sources.map((s) => {
    const bits = [s.title];
    if (s.period) bits.push(s.period);
    else if (s.reportDate) bits.push(s.reportDate);
    return `• ${bits.join(" · ")}`;
  });
  return `\n\nSources\n${lines.join("\n")}`;
}

async function buildComparisonContext(
  question: string,
  filters: RetrievalFilters,
): Promise<string | null> {
  if (!isComparisonIntent(question)) return null;

  const comparison = await compareLatestDocuments({
    companyId: filters.companyId,
    currentReportId: filters.reportId,
  });

  if (!comparison.available) {
    return comparison.message;
  }

  const trendLines = (await getAvailableTrendSummaries(filters.companyId))
    .filter((t) => t.available)
    .slice(0, 3)
    .map(
      (t) =>
        `${t.metric}: ${t.points.map((p) => `${p.period ?? p.title}=${p.value}`).join(" → ")}`,
    );

  return [
    `Comparación: «${comparison.current.title}» (${comparison.current.period}) vs «${comparison.previous.title}» (${comparison.previous.period})`,
    ...comparison.highlights,
    trendLines.length ? `Tendencias: ${trendLines.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function tryGptCache(params: {
  question: string;
  filters: RetrievalFilters;
  processingId?: string | null;
}): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const cacheKey = buildGptCacheKey({
      companyId: params.filters.companyId,
      question: params.question,
      processingId: params.processingId,
    });
    return await getCachedGptResponse({ admin, cacheKey });
  } catch {
    return null;
  }
}

async function storeGptCache(params: {
  question: string;
  filters: RetrievalFilters;
  processingId?: string | null;
  response: string;
  modelName?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const cacheKey = buildGptCacheKey({
      companyId: params.filters.companyId,
      question: params.question,
      processingId: params.processingId,
    });
    await setCachedGptResponse({
      admin,
      cacheKey,
      companyId: params.filters.companyId,
      question: params.question,
      response: params.response,
      modelName: params.modelName,
      processingId: params.processingId,
    });
  } catch {
    // cache write is best-effort
  }
}

export async function answerWithRetrieval(params: {
  question: string;
  filters: RetrievalFilters;
}): Promise<{
  message: string;
  sources: SourceReference[];
  model: string | null;
  tier: AnswerTier;
}> {
  const intent = detectQueryIntent(params.question);

  const structured = await answerFromStructuredQuery({
    question: params.question,
    companyId: params.filters.companyId,
    reportId: params.filters.reportId,
    period: params.filters.period,
  });

  if (structured.answered) {
    return {
      message:
        structured.message + formatSourcesAppendix(structured.sources),
      sources: structured.sources,
      model: null,
      tier: "structured",
    };
  }

  const { processingId } = await resolveAllowedProcessingIds(params.filters);

  if (
    isOpenAIConfigured() &&
    requiresOpenAI(intent)
  ) {
    const cached = await tryGptCache({
      question: params.question,
      filters: params.filters,
      processingId,
    });
    if (cached) {
      return {
        message: cached,
        sources: [],
        model: "cache",
        tier: "cached",
      };
    }
  }

  let chunks = await retrieveRelevantChunks(
    params.question,
    params.filters,
    8,
  );
  let tier: AnswerTier = "chunks";

  if (!chunks.length) {
    chunks = await retrieveFromSummaries(params.question, params.filters);
    if (chunks.length) tier = "summaries";
  }

  if (!chunks.length) {
    const pending = await getPendingNotice(params.filters.companyId);
    if (pending) {
      return {
        message: pending.message + formatSourcesAppendix(pending.sources),
        sources: pending.sources,
        model: null,
        tier: "pending",
      };
    }
  }

  if (!chunks.length) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("document_processing")
      .select("id", { count: "exact", head: true })
      .eq("company_id", params.filters.companyId)
      .eq("status", "completed");

    if ((count ?? 0) > 0) {
      return {
        message:
          "No encuentro esa información en los documentos disponibles.",
        sources: [],
        model: null,
        tier: "chunks",
      };
    }

    const context = await buildAssistantContext({
      id: params.filters.userId ?? "",
      email: "",
      full_name: null,
      role: "client",
      company_id: params.filters.companyId,
      created_at: "",
      updated_at: "",
    });

    return {
      message: `Aún no hay documentos analizados por SinexIA para ${context.companyName}. Cuando se publiquen o suban reportes PDF/Excel/CSV, podrá preguntar sobre saldos, nómina y aging con fuentes.\n\nEstado del portal (solo mientras no hay documentos analizados): ${context.availableReports} reportes publicados, ${context.pendingDocuments} documentos pendientes en Inbox.`,
      sources: [],
      model: null,
      tier: "portal_metadata",
    };
  }

  const sources = buildSourceReferences(chunks);
  const comparisonBlock = await buildComparisonContext(
    params.question,
    params.filters,
  );

  const contextBlocks = chunks
    .map((c, i) => {
      const loc = [
        c.title,
        c.detected_period ?? c.period ?? c.report_date,
        c.page_number != null ? `pág. ${c.page_number}` : null,
        c.sheet_name ? `hoja ${c.sheet_name}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `[${i + 1}] ${loc}\n${c.content.slice(0, 1200)}`;
    })
    .join("\n\n");

  const filtersNote = [
    params.filters.reportId
      ? `documento=${params.filters.reportId}`
      : "todos los documentos de la empresa",
    params.filters.category
      ? `categoría=${params.filters.category}`
      : null,
    params.filters.period ? `periodo=${params.filters.period}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (!isOpenAIConfigured()) {
    const top = chunks[0];
    return {
      message:
        `Según el documento «${top.title}» (${top.detected_period ?? top.period ?? "sin periodo"}):\n\n${top.content.slice(0, 600)}\n\n(Configure OPENAI_API_KEY para respuestas generativas de SinexIA.)` +
        formatSourcesAppendix(sources),
      sources,
      model: null,
      tier,
    };
  }

  if (!requiresOpenAI(intent) && intent !== "unknown") {
    const top = chunks[0];
    return {
      message:
        `Según el documento «${top.title}» (${top.detected_period ?? top.period ?? "sin periodo"}):\n\n${top.content.slice(0, 600)}` +
        formatSourcesAppendix(sources),
      sources,
      model: null,
      tier,
    };
  }

  const result = await chatCompletion({
    system: CHAT_SYSTEM_PROMPT,
    user: CHAT_USER_TEMPLATE({
      question: params.question,
      contextBlocks,
      filtersNote,
      comparisonBlock: comparisonBlock ?? undefined,
    }),
  });

  const message = result.content.includes("Sources")
    ? result.content
    : result.content + formatSourcesAppendix(sources);

  await storeGptCache({
    question: params.question,
    filters: params.filters,
    processingId,
    response: message,
    modelName: result.model,
  });

  return {
    message,
    sources,
    model: result.model,
    tier,
  };
}
