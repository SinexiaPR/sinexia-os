import {
  CLASSIFICATION_SYSTEM_PROMPT,
  CLASSIFICATION_USER_TEMPLATE,
} from "@/lib/intelligence/prompts";
import {
  classifyWithStructuredOutput,
  isOpenAIConfigured,
} from "@/lib/intelligence/providers/openai";
import { ALL_DETECTED_TYPES } from "@/lib/intelligence/constants";
import type {
  DetectedDocumentType,
  StructuredSummary,
} from "@/lib/intelligence/types";

const KEYWORD_HINTS: Array<{
  type: DetectedDocumentType;
  patterns: RegExp[];
}> = [
  {
    type: "homebase_export",
    patterns: [/homebase/i, /timecard/i, /time\s*clock/i],
  },
  {
    type: "quickbooks_report",
    patterns: [/quickbooks/i, /\bQB\b/, /intuit/i],
  },
  {
    type: "profit_and_loss",
    patterns: [/profit\s*&\s*loss/i, /profit\s*and\s*loss/i, /\bP\s*&\s*L\b/i, /estado\s*de\s*resultados/i],
  },
  {
    type: "balance_sheet",
    patterns: [/balance\s*sheet/i, /balance\s*general/i],
  },
  {
    type: "payroll",
    patterns: [/n[oó]mina/i, /payroll/i, /horas\s*extra/i, /\btips?\b/i, /empleado/i],
  },
  {
    type: "accounts_receivable",
    patterns: [
      /cuentas?\s*por\s*cobrar/i,
      /accounts?\s*receivable/i,
      /customer\s*balance/i,
      /a\/r\s*aging/i,
      /\bAR\b/,
    ],
  },
  {
    type: "accounts_payable",
    patterns: [
      /cuentas?\s*por\s*pagar/i,
      /accounts?\s*payable/i,
      /a\/p\s*aging/i,
      /\bAP\b/,
      /proveedor/i,
    ],
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
    type: "bank_statement",
    patterns: [/bank\s*statement/i, /estado\s*de\s*cuenta\s*banc/i],
  },
  {
    type: "invoice",
    patterns: [/\binvoice\b/i, /\bfactura\b/i],
  },
  {
    type: "purchase_order",
    patterns: [/purchase\s*order/i, /\bP\.?O\.?\b/, /orden\s*de\s*compra/i],
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

function detectSourceSystem(text: string, filename: string): string | null {
  const haystack = `${filename}\n${text}`.slice(0, 4000);
  if (/homebase/i.test(haystack)) return "Homebase";
  if (/quickbooks|intuit/i.test(haystack)) return "QuickBooks";
  if (/\.csv$/i.test(filename)) return "CSV export";
  if (/\.xlsx?$/i.test(filename)) return "Excel";
  if (/\.pdf$/i.test(filename)) return "PDF";
  return null;
}

function detectCurrency(text: string): string | null {
  if (/\$|USD|US\$/i.test(text)) return "USD";
  if (/€|EUR/i.test(text)) return "EUR";
  if (/£|GBP/i.test(text)) return "GBP";
  return null;
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
    currency: detectCurrency(text),
    sourceSystem: detectSourceSystem(text, filename),
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
    // Fill gaps with heuristics
    if (!result.summary.currency) {
      result.summary.currency = detectCurrency(sample);
    }
    if (!result.summary.sourceSystem) {
      result.summary.sourceSystem = detectSourceSystem(
        sample,
        params.filename,
      );
    }
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

export function isDetectedDocumentType(
  value: unknown,
): value is DetectedDocumentType {
  return (
    typeof value === "string" &&
    (ALL_DETECTED_TYPES as readonly string[]).includes(value)
  );
}

export function detectDocumentTypeHeuristic(
  filename: string,
  extractedText: string,
): DetectedDocumentType {
  return heuristicClassify(extractedText.slice(0, 8000), filename);
}
