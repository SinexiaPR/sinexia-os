import type { DetectedDocumentType } from "@/lib/intelligence/types";

export type PayrollEmployeeSummary = {
  name: string;
  shifts_count: number;
  total_hours: number | null;
  overtime_hours: number | null;
  total_tips: number | null;
  gross_pay?: number | null;
  net_pay?: number | null;
};

export type PayrollExtractionDiagnostics = {
  unique_employee_count: number;
  total_hours: number | null;
  total_tips: number | null;
  rows_included: number;
  rows_skipped: number;
  rows_deduplicated: number;
  unique_shift_rows: number;
  sheets_processed: string[];
  sheets_skipped: string[];
  sheet_summaries: Array<{
    sheetName: string;
    employeeColumn: string | null;
    detectedHourColumns: string[];
    includedRows: number;
    excludedRows: number;
    rawHoursTotal: number;
    normalizedHoursTotal: number;
  }>;
};

export type PayrollProfile = {
  company: string | null;
  company_id?: string | null;
  report_id?: string | null;
  period: string | null;
  employee_count: number | null;
  total_payroll: number | null;
  total_hours: number | null;
  overtime_hours: number | null;
  total_tips: number | null;
  employees?: PayrollEmployeeSummary[];
  extraction_diagnostics?: PayrollExtractionDiagnostics;
  source_format?: "xlsx" | "pdf" | "text" | null;
  source_document: string | null;
  upload_date: string | null;
  source_system?: string | null;
};

export type AccountsReceivableProfile = {
  company: string | null;
  period: string | null;
  customer_count: number | null;
  invoice_count: number | null;
  total_receivable: number | null;
  oldest_invoice_days: number | null;
  source_document: string | null;
  upload_date: string | null;
  /** Present when QuickBooks AR specialized extractor ran */
  kind?: "quickbooks_ar";
  variant?: string;
  report_date?: string | null;
  currency?: string | null;
  source_system?: string;
  grand_total?: number | null;
  current?: number | null;
  days_1_30?: number | null;
  days_31_60?: number | null;
  days_61_90?: number | null;
  days_90_plus?: number | null;
  customers?: Array<{
    name: string;
    invoice_count: number;
    balance: number;
    oldest_invoice: string | null;
    current?: number | null;
    days_1_30?: number | null;
    days_31_60?: number | null;
    days_61_90?: number | null;
    days_90_plus?: number | null;
  }>;
  original_filename?: string | null;
};

export type AccountsPayableProfile = {
  company: string | null;
  period: string | null;
  vendor_count: number | null;
  invoice_count: number | null;
  total_payable: number | null;
  source_document: string | null;
  upload_date: string | null;
};

export type ProfitLossProfile = {
  company: string | null;
  period: string | null;
  revenue: number | null;
  expenses: number | null;
  net_income: number | null;
  source_document: string | null;
};

export type BalanceSheetProfile = {
  company: string | null;
  period: string | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  source_document: string | null;
};

export type BankReconciliationProfile = {
  company: string | null;
  period: string | null;
  bank_balance: number | null;
  book_balance: number | null;
  difference: number | null;
  source_document: string | null;
  upload_date: string | null;
};

export type BankStatementProfile = {
  company: string | null;
  period: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  transaction_count: number | null;
  source_document: string | null;
  upload_date: string | null;
};

export type CustomReportProfile = {
  company: string | null;
  period: string | null;
  label: string | null;
  total_amount: number | null;
  row_count: number | null;
  source_document: string | null;
  upload_date: string | null;
};

export type DocumentProfileData =
  | PayrollProfile
  | AccountsReceivableProfile
  | AccountsPayableProfile
  | ProfitLossProfile
  | BalanceSheetProfile
  | BankReconciliationProfile
  | BankStatementProfile
  | CustomReportProfile;

export type ExtractionProfileResult = {
  documentType: DetectedDocumentType;
  period: string | null;
  structuredData: Record<string, unknown>;
  summary: string;
  confidence: number;
};

export type DocumentProfileRow = {
  id: string;
  document_processing_id: string;
  company_id: string;
  report_id: string | null;
  document_id: string | null;
  document_type: DetectedDocumentType | null;
  period: string | null;
  structured_data: Record<string, unknown>;
  summary: string | null;
  extraction_confidence: number | null;
  source_document: string | null;
  upload_date: string | null;
  created_at: string;
  updated_at: string;
};

export const REPORT_CATEGORY_TO_TYPE: Record<string, DetectedDocumentType> = {
  Aging: "accounts_receivable",
  "Profit & Loss": "profit_and_loss",
  "Balance Sheet": "balance_sheet",
  "Bank Reconciliation": "bank_reconciliation",
  Payroll: "payroll",
  Statement: "bank_statement",
  "Custom Report": "custom_aging",
};
