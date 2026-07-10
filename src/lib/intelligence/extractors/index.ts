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

export function runSpecializedExtractor(
  params: RunSpecializedExtractorParams,
): ExtractionProfileResult {
  const type = resolveExtractorType(
    params.documentType,
    params.reportCategory,
  );
  const base = {
    filename: params.filename,
    titleHint: params.titleHint,
    fallbackPeriod: params.fallbackPeriod,
    uploadDate: params.uploadDate,
  };

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
    case "quickbooks_report":
      return extractProfitLossProfile(params.extraction, base);
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

  return {
    documentType: profile.documentType ?? heuristicType,
    companyName: typeof data.company === "string" ? data.company : null,
    reportPeriod: profile.period,
    documentDate: null,
    currency: null,
    sourceSystem: "structured_extractor",
    mainTotals,
    entities: {},
    briefSummary: profile.summary,
    warnings:
      profile.confidence < 0.4
        ? ["Confianza de extracción baja; algunos campos pueden ser nulos."]
        : [],
    confidence: profile.confidence,
  };
}
