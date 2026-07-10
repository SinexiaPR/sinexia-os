export const INTELLIGENCE_PROMPT_VERSION = "v1.0.0";

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
  payroll: "Nómina / Payroll",
  accounts_receivable: "Cuentas por cobrar",
  accounts_payable: "Cuentas por pagar",
  custom_aging: "Aging personalizado",
  bank_reconciliation: "Conciliación bancaria",
  statement: "Estado de cuenta",
  other: "Otro reporte",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  failed: "Falló",
  requires_ocr: "Requiere OCR",
};
