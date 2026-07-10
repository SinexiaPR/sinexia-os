import {
  CHAT_SYSTEM_PROMPT,
  CHAT_USER_TEMPLATE,
} from "@/lib/intelligence/prompts";
import {
  chatCompletion,
  createEmbeddings,
  isOpenAIConfigured,
} from "@/lib/intelligence/providers/openai";
import type { SourceReference } from "@/lib/intelligence/types";
import { createClient } from "@/lib/supabase/server";

export type RetrievalFilters = {
  companyId: string;
  reportId?: string | null;
  category?: string | null;
  period?: string | null;
  processingId?: string | null;
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
  title: string;
  period: string | null;
  detected_period: string | null;
  category: string | null;
};

export async function retrieveRelevantChunks(
  question: string,
  filters: RetrievalFilters,
  matchCount = 8,
): Promise<RetrievedChunk[]> {
  const supabase = await createClient();

  // Resolve optional processing id from report filter
  let processingId = filters.processingId ?? null;
  let allowedProcessingIds: string[] | null = null;

  if (filters.reportId || filters.category || filters.period) {
    let query = supabase
      .from("document_processing")
      .select(
        "id, report_id, detected_period, status, reports!inner(id, title, category, period, company_id)",
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

    allowedProcessingIds = filtered.map((r) => r.id);
    if (filters.reportId && filtered[0]) {
      processingId = filtered[0].id;
    }

    if (!allowedProcessingIds.length) {
      return [];
    }
  }

  // Embedding search when OpenAI is configured
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
      // fall through to keyword fallback
    }
  }

  // Keyword / recent-chunk fallback (no embeddings)
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
      "id, detected_period, report_id, reports(id, title, category, period, company_id)",
    )
    .eq("company_id", companyId)
    .in("id", processingIds);

  const byId = new Map(
    (processingRows ?? []).map((row) => [row.id, row]),
  );

  return matches.map((m) => {
    const proc = byId.get(m.document_processing_id);
    const report = proc?.reports as unknown as {
      id: string;
      title: string;
      category: string;
      period: string;
      company_id: string;
    } | null;

    return {
      id: m.id,
      document_processing_id: m.document_processing_id,
      content: m.content,
      page_number: m.page_number,
      sheet_name: m.sheet_name,
      row_reference: m.row_reference,
      similarity: m.similarity,
      report_id: report?.id ?? proc?.report_id ?? null,
      title: report?.title ?? "Documento",
      period: report?.period ?? null,
      detected_period: proc?.detected_period ?? null,
      category: report?.category ?? null,
    };
  });
}

export function buildSourceReferences(
  chunks: RetrievedChunk[],
): SourceReference[] {
  const seen = new Set<string>();
  const refs: SourceReference[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.report_id}:${chunk.page_number}:${chunk.sheet_name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    refs.push({
      reportId: chunk.report_id ?? undefined,
      title: chunk.title,
      period: chunk.detected_period ?? chunk.period,
      pageNumber: chunk.page_number,
      sheetName: chunk.sheet_name,
      viewPath: chunk.report_id
        ? `/dashboard/reports?highlight=${chunk.report_id}`
        : undefined,
      downloadPath: chunk.report_id
        ? `/api/reports/${chunk.report_id}/download`
        : undefined,
    });
  }

  return refs;
}

export async function answerWithRetrieval(params: {
  question: string;
  filters: RetrievalFilters;
}): Promise<{
  message: string;
  sources: SourceReference[];
  model: string | null;
}> {
  const chunks = await retrieveRelevantChunks(
    params.question,
    params.filters,
    8,
  );

  if (!chunks.length) {
    return {
      message:
        "No encuentro esa información en los documentos disponibles.",
      sources: [],
      model: null,
    };
  }

  const sources = buildSourceReferences(chunks);
  const contextBlocks = chunks
    .map((c, i) => {
      const loc = [
        c.title,
        c.detected_period ?? c.period,
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
      : "todos los documentos",
    params.filters.category
      ? `categoría=${params.filters.category}`
      : null,
    params.filters.period ? `periodo=${params.filters.period}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (!isOpenAIConfigured()) {
    // Deterministic fallback: return top excerpt summary
    const top = chunks[0];
    return {
      message: `Según el documento «${top.title}» (${top.detected_period ?? top.period ?? "sin periodo"}):\n\n${top.content.slice(0, 600)}\n\n(Configure OPENAI_API_KEY para respuestas generativas de SinexIA.)`,
      sources,
      model: null,
    };
  }

  const result = await chatCompletion({
    system: CHAT_SYSTEM_PROMPT,
    user: CHAT_USER_TEMPLATE({
      question: params.question,
      contextBlocks,
      filtersNote,
    }),
  });

  return {
    message: result.content,
    sources,
    model: result.model,
  };
}
