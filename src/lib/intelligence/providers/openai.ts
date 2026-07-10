import OpenAI from "openai";
import {
  CHAT_MODEL,
  CLASSIFICATION_MODEL,
  EMBEDDING_MODEL,
} from "@/lib/intelligence/constants";
import type { StructuredSummary } from "@/lib/intelligence/types";

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: key });
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export async function createEmbeddings(
  texts: string[],
): Promise<{ embeddings: number[][]; usage: TokenUsage }> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  const embeddings = response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);

  return {
    embeddings,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

export async function classifyWithStructuredOutput(params: {
  system: string;
  user: string;
}): Promise<{ summary: StructuredSummary; usage: TokenUsage; model: string }> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: CLASSIFICATION_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<StructuredSummary>;
  try {
    parsed = JSON.parse(raw) as Partial<StructuredSummary>;
  } catch {
    parsed = {};
  }

  const summary: StructuredSummary = {
    documentType: normalizeType(parsed.documentType),
    companyName: parsed.companyName ?? null,
    reportPeriod: parsed.reportPeriod ?? null,
    documentDate: parsed.documentDate ?? null,
    currency:
      typeof parsed.currency === "string" ? parsed.currency : null,
    sourceSystem:
      typeof parsed.sourceSystem === "string" ? parsed.sourceSystem : null,
    mainTotals: parsed.mainTotals ?? {},
    entities: parsed.entities ?? {},
    briefSummary:
      parsed.briefSummary ??
      "Resumen automático no disponible con suficiente confianza.",
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    confidence:
      typeof parsed.confidence === "number" ? parsed.confidence : 0.4,
  };

  return {
    summary,
    model: CLASSIFICATION_MODEL,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

export async function chatCompletion(params: {
  system: string;
  user: string;
}): Promise<{ content: string; usage: TokenUsage; model: string }> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });

  return {
    content:
      response.choices[0]?.message?.content?.trim() ||
      "No encuentro esa información en los documentos disponibles.",
    model: CHAT_MODEL,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

function normalizeType(
  value: unknown,
): StructuredSummary["documentType"] {
  const allowed = new Set([
    "payroll",
    "accounts_receivable",
    "accounts_payable",
    "custom_aging",
    "bank_reconciliation",
    "statement",
    "homebase_export",
    "quickbooks_report",
    "profit_and_loss",
    "balance_sheet",
    "bank_statement",
    "invoice",
    "purchase_order",
    "other",
  ]);
  if (typeof value === "string" && allowed.has(value)) {
    return value as StructuredSummary["documentType"];
  }
  return "other";
}
