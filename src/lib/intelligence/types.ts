export type DocumentProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "requires_ocr";

export type DetectedDocumentType =
  | "payroll"
  | "accounts_receivable"
  | "accounts_payable"
  | "custom_aging"
  | "bank_reconciliation"
  | "statement"
  | "homebase_export"
  | "quickbooks_report"
  | "profit_and_loss"
  | "balance_sheet"
  | "bank_statement"
  | "invoice"
  | "purchase_order"
  | "other";

export type ExtractedChunk = {
  content: string;
  pageNumber: number | null;
  sheetName: string | null;
  rowReference: string | null;
};

export type ExtractionResult = {
  text: string;
  chunks: ExtractedChunk[];
  requiresOcr: boolean;
  meta: {
    pageCount?: number;
    sheetCount?: number;
    rowCount?: number;
    format: "pdf" | "xlsx" | "xls" | "csv" | "unsupported";
  };
};

export type StructuredSummary = {
  documentType: DetectedDocumentType;
  companyName: string | null;
  reportPeriod: string | null;
  documentDate: string | null;
  currency: string | null;
  sourceSystem: string | null;
  mainTotals: Record<string, number | string | null>;
  entities: {
    customers?: string[];
    vendors?: string[];
    employees?: string[];
    invoices?: string[];
    balances?: Array<{ label: string; amount: number | null }>;
    dueDates?: string[];
  };
  briefSummary: string;
  warnings: string[];
  confidence: number;
};

export type SourceReference = {
  reportId?: string;
  documentId?: string;
  title: string;
  period: string | null;
  reportDate?: string | null;
  pageNumber?: number | null;
  sheetName?: string | null;
  viewPath?: string;
  downloadPath?: string;
};

export type TrendPoint = {
  reportId: string;
  title: string;
  period: string | null;
  processedAt: string | null;
  value: number | null;
  label: string;
};

export type TrendResult = {
  category: string;
  metric: string;
  points: TrendPoint[];
  available: boolean;
  message: string | null;
  comparedDocuments: Array<{
    reportId: string;
    title: string;
    period: string | null;
  }>;
};

export type DocumentComparison = {
  available: boolean;
  message: string | null;
  current: { title: string; period: string | null; reportId?: string };
  previous: { title: string; period: string | null; reportId?: string };
  totalDelta: Record<string, { previous: number | null; current: number | null; change: number | null }>;
  newEntities: string[];
  removedEntities: string[];
  highlights: string[];
};
