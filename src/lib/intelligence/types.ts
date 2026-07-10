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
  comparedDocuments: Array<{ reportId: string; title: string; period: string | null }>;
};
