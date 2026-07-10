export const INTELLIGENCE_PROMPT_VERSION = "v1.1.0";

export const INTELLIGENCE_LIMITS = {
  maxFileBytes: 25 * 1024 * 1024,
  maxPdfPages: 80,
  maxSheets: 20,
  maxRowsPerSheet: 2000,
  maxChunksPerDocument: 120,
  maxChunkChars: 1800,
  maxExtractedTextChars: 200_000,
  embeddingBatchSize: 32,
  minUsableTextChars: 40,
} as const;

export const ANALYZABLE_EXTENSIONS = new Set([
  "pdf",
  "xlsx",
  "xls",
  "csv",
]);

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const CHAT_MODEL = "gpt-4o-mini";
export const CLASSIFICATION_MODEL = "gpt-4o-mini";

export const DETECTED_TYPE_LABELS: Record<string, string> = {
  payroll: "Payroll / Nómina",
  accounts_receivable: "Accounts Receivable Aging",
  accounts_payable: "Accounts Payable Aging",
  custom_aging: "Aging personalizado",
  bank_reconciliation: "Bank Reconciliation",
  statement: "Statement / Estado de cuenta",
  homebase_export: "Homebase Export",
  quickbooks_report: "QuickBooks Report",
  profit_and_loss: "Profit & Loss",
  balance_sheet: "Balance Sheet",
  bank_statement: "Bank Statement",
  invoice: "Invoice",
  purchase_order: "Purchase Order",
  other: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  failed: "Falló",
  requires_ocr: "Requiere OCR",
};

export const ALL_DETECTED_TYPES = [
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
] as const;
