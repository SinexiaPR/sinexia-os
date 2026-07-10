import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_USER_TEMPLATE,
} from "@/lib/intelligence/prompts";
import {
  classifyWithStructuredOutput,
  isOpenAIConfigured,
} from "@/lib/intelligence/providers/openai";
import type {
  DetectedDocumentType,
  StructuredSummary,
} from "@/lib/intelligence/types";

const KEYWORD_HINTS: Array<{ type: DetectedDocumentType; patterns: RegExp[] }> = [
  {
    type: "payroll",
    patterns: [/n[oó]mina/i, /payroll/i, /horas\s*extra/i, /\btips?\b/i, /empleado/i],
  },
  {
    type: "accounts_receivable",
    patterns: [/cuentas?\s*por\s*cobrar/i, /accounts?\s*receivable/i, /\bAR\b/, /aging.*receiv/i],
  },
  {
    type: "accounts_payable",
    patterns: [/cuentas?\s*por\s*pagar/i, /accounts?\s*payable/i, /\bAP\b/, /proveedor/i],
  },
  {
    type: "custom_aging",
    patterns: [/aging\s*personaliz/i, /custom\s*aging/i],
  },
  {
    type: "bank_reconciliation",
    patterns: [/conciliaci[oó]n\s*bancaria/i, /bank\s*reconcil/i],
  },
  {
    type: "statement",
    patterns: [/estado\s*de\s*cuenta/i, /statement/i],
  },
];

function heuristicClassify(text: string, filename: string): DetectedDocumentType {
  const haystack = `${filename}\n${text}`.slice(0, 8000);
  for (const hint of KEYWORD_HINTS) {
    if (hint.patterns.some((p) => p.test(haystack))) {
      return hint.type;
    }
  }
  return "other";
}

function heuristicSummary(
  text: string,
  filename: string,
): StructuredSummary {
  const documentType = heuristicClassify(text, filename);
  return {
    documentType,
    companyName: null,
    reportPeriod: null,
    documentDate: null,
    mainTotals: {},
    entities: {},
    briefSummary:
      "Clasificación heurística aplicada (OpenAI no configurado). Revise el documento original para totales.",
    warnings: [
      "OPENAI_API_KEY no configurada; resumen estructurado limitado.",
    ],
    confidence: 0.25,
  };
}

export async function classifyDocument(params: {
  filename: string;
  extractedText: string;
}): Promise<{
  summary: StructuredSummary;
  model: string | null;
  tokenUsage: number;
}> {
  const sample = params.extractedText.slice(0, 12_000);

  if (!isOpenAIConfigured()) {
    return {
      summary: heuristicSummary(sample, params.filename),
      model: null,
      tokenUsage: 0,
    };
  }

  try {
    const result = await classifyWithStructuredOutput({
      system: CLASSIFICATION_SYSTEM_PROMPT,
      user: CLASSIFICATION_USER_TEMPLATE(params.filename, sample),
    });
    return {
      summary: result.summary,
      model: result.model,
      tokenUsage: result.usage.totalTokens,
    };
  } catch (error) {
    const fallback = heuristicSummary(sample, params.filename);
    fallback.warnings.push(
      `Clasificación AI falló: ${error instanceof Error ? error.message : "error"}`,
    );
    return { summary: fallback, model: null, tokenUsage: 0 };
  }
}
