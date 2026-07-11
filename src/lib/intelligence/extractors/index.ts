import { INTELLIGENCE_LIMITS } from "@/lib/intelligence/constants";
import { getFileExtension } from "@/lib/intelligence/extraction/utils";
import { extractPayrollFromExcelBuffer } from "@/lib/intelligence/extractors/payroll-excel";
import { extractPayrollFromPdfText } from "@/lib/intelligence/extractors/payroll-pdf";
import { isLikelyPayrollDocument } from "@/lib/intelligence/extractors/payroll-detect";
import {
  extractAccountsPayableProfile,
  extractAccountsReceivableProfile,
  extractBalanceSheetProfile,
  extractBankReconciliationProfile,
  extractBankStatementProfile,
  extractCustomReportProfile,
  extractPayrollProfile,
  extractProfitLossProfile,
} from "@/lib/intelligence/extractors/specialized";
import {
  detectQuickBooksAR,
  extractQuickBooksARProfile,
} from "@/lib/intelligence/extractors/quickbooks-ar";
import { REPORT_CATEGORY_TO_TYPE } from "@/lib/intelligence/profiles/types";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";
import type {
  DetectedDocumentType,
  ExtractionResult,
  StructuredSummary,
} from "@/lib/intelligence/types";

type RunSpecializedExtractorParams = {
  documentType: DetectedDocumentType;
  extraction: ExtractionResult;
  filename: string;
  titleHint: string;
  fallbackPeriod: string | null;
  uploadDate: string;
  reportCategory?: string | null;
  buffer?: Buffer | null;
};

export function resolveExtractorType(
  documentType: DetectedDocumentType,
  reportCategory?: string | null,
): DetectedDocumentType {
  if (reportCategory && REPORT_CATEGORY_TO_TYPE[reportCategory]) {
    return REPORT_CATEGORY_TO_TYPE[reportCategory];
  }
  return documentType;
}

function buildPayrollSignals(params: RunSpecializedExtractorParams) {
  return {
    reportCategory: params.reportCategory,
    titleHint: params.titleHint,
    filename: params.filename,
    text: params.extraction.text,
  };
}

function shouldTryPayrollExtraction(
  params: RunSpecializedExtractorParams,
  resolvedType: DetectedDocumentType,
): boolean {
  return (
    resolvedType === "payroll" ||
    resolvedType === "homebase_export" ||
    isLikelyPayrollDocument(buildPayrollSignals(params))
  );
}

function tryPayrollExtraction(
  params: RunSpecializedExtractorParams,
  base: {
    filename: string;
    titleHint: string;
    fallbackPeriod: string | null;
    uploadDate: string;
  },
): ExtractionProfileResult | null {
  const ext = getFileExtension(params.filename);

  if (params.buffer && (ext === "xlsx" || ext === "xls")) {
    const excelPayroll = extractPayrollFromExcelBuffer(params.buffer, base);
    if (excelPayroll) {
      return excelPayroll;
    }
  }

  if (
    ext === "pdf" &&
    !params.extraction.requiresOcr &&
    params.extraction.text.length >= INTELLIGENCE_LIMITS.minUsableTextChars
  ) {
    const pdfPayroll = extractPayrollFromPdfText(params.extraction.text, base);
    if (pdfPayroll) {
      return pdfPayroll;
    }
  }

  if (
    params.extraction.text.length >= INTELLIGENCE_LIMITS.minUsableTextChars &&
    isLikelyPayrollDocument(buildPayrollSignals(params))
  ) {
    const textPayroll = extractPayrollFromPdfText(params.extraction.text, base);
    if (textPayroll) {
      return textPayroll;
    }
  }

  return null;
}

export function runSpecializedExtractor(
  params: RunSpecializedExtractorParams,
): ExtractionProfileResult {
  const base = {
    filename: params.filename,
    titleHint: params.titleHint,
    fallbackPeriod: params.fallbackPeriod,
    uploadDate: params.uploadDate,
  };

  // Specialized QuickBooks AR processor (v1) — try first, keep generic fallback
  const qbVariant = detectQuickBooksAR(
    params.extraction.text,
    params.filename,
    params.titleHint,
  );
  if (
    qbVariant ||
    params.reportCategory === "Aging" ||
    params.documentType === "accounts_receivable" ||
    params.documentType === "custom_aging" ||
    params.documentType === "quickbooks_report"
  ) {
    const qb = extractQuickBooksARProfile(params.extraction, {
      ...base,
      buffer: params.buffer,
    });
    if (qb && qb.confidence >= 0.35) {
      return qb;
    }
  }

  const type = resolveExtractorType(
    params.documentType,
    params.reportCategory,
  );

  if (shouldTryPayrollExtraction(params, type)) {
    const payroll = tryPayrollExtraction(params, base);
    if (payroll) {
      return payroll;
    }
  }

  switch (type) {
    case "payroll":
    case "homebase_export":
      return extractPayrollProfile(params.extraction, base);
    case "accounts_receivable":
    case "custom_aging":
      return extractAccountsReceivableProfile(params.extraction, base);
    case "accounts_payable":
      return extractAccountsPayableProfile(params.extraction, base);
    case "profit_and_loss":
      return extractProfitLossProfile(params.extraction, base);
    case "quickbooks_report": {
      // Prefer AR if aging signals exist; otherwise P&L heuristic
      const qb = extractQuickBooksARProfile(params.extraction, {
        ...base,
        buffer: params.buffer,
      });
      if (qb && qb.confidence >= 0.4) return qb;
      return extractProfitLossProfile(params.extraction, base);
    }
    case "balance_sheet":
      return extractBalanceSheetProfile(params.extraction, base);
    case "bank_reconciliation":
      return extractBankReconciliationProfile(params.extraction, base);
    case "bank_statement":
    case "statement":
      return extractBankStatementProfile(params.extraction, base);
    default:
      return extractCustomReportProfile(params.extraction, base);
  }
}

export function profileToStructuredSummary(
  profile: ExtractionProfileResult,
  heuristicType: DetectedDocumentType,
): StructuredSummary {
  const data = profile.structuredData;
  const mainTotals: Record<string, number | string | null> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "number") {
      mainTotals[key] = value;
    }
  }

  const customers = Array.isArray(data.customers)
    ? (data.customers as Array<{ name?: string }>)
        .map((c) => c.name)
        .filter((n): n is string => Boolean(n))
        .slice(0, 25)
    : [];

  return {
    documentType: profile.documentType ?? heuristicType,
    companyName: typeof data.company === "string" ? data.company : null,
    reportPeriod: profile.period,
    documentDate:
      typeof data.report_date === "string" ? data.report_date : null,
    currency: typeof data.currency === "string" ? data.currency : null,
    sourceSystem:
      typeof data.source_system === "string"
        ? data.source_system
        : "structured_extractor",
    mainTotals,
    entities: {
      customers,
      balances: customers.length
        ? (data.customers as Array<{ name: string; balance: number }>)
            .slice(0, 15)
            .map((c) => ({
              label: c.name,
              amount: typeof c.balance === "number" ? c.balance : null,
            }))
        : undefined,
    },
    briefSummary: profile.summary,
    warnings:
      profile.confidence < 0.4
        ? ["Confianza de extracción baja; algunos campos pueden ser nulos."]
        : [],
    confidence: profile.confidence,
  };
}
