import {
  buildSummary,
  confidenceFromFields,
  countMatches,
  findLabeledAmount,
  findLabeledCount,
} from "@/lib/intelligence/extractors/base";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";
import type { ExtractionResult } from "@/lib/intelligence/types";

type ExtractorContext = {
  text: string;
  filename: string;
  titleHint: string;
  fallbackPeriod: string | null;
  uploadDate: string;
};

function ctxFrom(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractorContext {
  return { ...params, text: extraction.text };
}

export function extractPayrollProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod, uploadDate } = ctxFrom(
    extraction,
    params,
  );

  const total_payroll = findLabeledAmount(text, [
    /total\s*payroll/i,
    /total\s*gross/i,
    /n[oó]mina\s*total/i,
    /total\s*n[oó]mina/i,
  ]);
  const employee_count =
    findLabeledCount(text, [/employees?/i, /empleados?/i, /staff/i]) ??
    countMatches(text, /\bemployee\b|\bempleado\b/i);
  const overtime_hours = findLabeledAmount(text, [
    /overtime\s*hours?/i,
    /horas?\s*extra/i,
    /OT\s*hours?/i,
  ]);
  const total_tips = findLabeledAmount(text, [/tips?/i, /propinas?/i]);
  const total_hours = findLabeledAmount(text, [
    /total\s*hours?/i,
    /horas?\s*totales?/i,
  ]);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    employee_count,
    total_payroll,
    total_hours,
    overtime_hours,
    total_tips,
    source_document: titleHint,
    upload_date: uploadDate,
  };

  return {
    documentType: "payroll",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      total_payroll != null ? `Nómina total: $${total_payroll.toLocaleString()}` : null,
      employee_count != null ? `${employee_count} empleados` : null,
      overtime_hours != null ? `${overtime_hours} h extra` : null,
    ]),
    confidence: confidenceFromFields([
      total_payroll,
      employee_count,
      overtime_hours,
      total_tips,
    ]),
  };
}

export function extractAccountsReceivableProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod, uploadDate } = ctxFrom(
    extraction,
    params,
  );

  const total_receivable = findLabeledAmount(text, [
    /total\s*receivable/i,
    /accounts?\s*receivable/i,
    /cuentas?\s*por\s*cobrar/i,
    /outstanding/i,
    /total\s*due/i,
  ]);
  const customer_count =
    findLabeledCount(text, [/customers?/i, /clientes?/i]) ??
    countMatches(text, /\bcustomer\b|\bcliente\b/i);
  const invoice_count =
    findLabeledCount(text, [/invoices?/i, /facturas?/i]) ??
    countMatches(text, /\binvoice\b|\bfactura\b/i);
  const oldest_invoice_days = findLabeledCount(text, [
    /oldest\s*invoice/i,
    /m[aá]s\s*antigu/i,
    /days?\s*past\s*due/i,
  ]);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    customer_count,
    invoice_count,
    total_receivable,
    oldest_invoice_days,
    source_document: titleHint,
    upload_date: uploadDate,
  };

  return {
    documentType: "accounts_receivable",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      total_receivable != null
        ? `Total por cobrar: $${total_receivable.toLocaleString()}`
        : null,
      customer_count != null ? `${customer_count} clientes` : null,
      invoice_count != null ? `${invoice_count} facturas` : null,
    ]),
    confidence: confidenceFromFields([
      total_receivable,
      customer_count,
      invoice_count,
    ]),
  };
}

export function extractAccountsPayableProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod, uploadDate } = ctxFrom(
    extraction,
    params,
  );

  const total_payable = findLabeledAmount(text, [
    /total\s*payable/i,
    /accounts?\s*payable/i,
    /cuentas?\s*por\s*pagar/i,
  ]);
  const vendor_count =
    findLabeledCount(text, [/vendors?/i, /proveedores?/i]) ??
    countMatches(text, /\bvendor\b|\bproveedor\b/i);
  const invoice_count =
    findLabeledCount(text, [/invoices?/i, /facturas?/i]) ??
    countMatches(text, /\binvoice\b|\bfactura\b/i);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    vendor_count,
    invoice_count,
    total_payable,
    source_document: titleHint,
    upload_date: uploadDate,
  };

  return {
    documentType: "accounts_payable",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      total_payable != null
        ? `Total por pagar: $${total_payable.toLocaleString()}`
        : null,
      vendor_count != null ? `${vendor_count} proveedores` : null,
    ]),
    confidence: confidenceFromFields([total_payable, vendor_count, invoice_count]),
  };
}

export function extractProfitLossProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod } = ctxFrom(extraction, params);

  const revenue = findLabeledAmount(text, [
    /total\s*income/i,
    /revenue/i,
    /ingresos?/i,
    /ventas?/i,
  ]);
  const expenses = findLabeledAmount(text, [
    /total\s*expenses?/i,
    /gastos?/i,
    /expenses?/i,
  ]);
  const net_income = findLabeledAmount(text, [
    /net\s*income/i,
    /utilidad/i,
    /net\s*profit/i,
  ]);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    revenue,
    expenses,
    net_income,
    source_document: titleHint,
  };

  return {
    documentType: "profit_and_loss",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      revenue != null ? `Ingresos: $${revenue.toLocaleString()}` : null,
      net_income != null ? `Utilidad neta: $${net_income.toLocaleString()}` : null,
    ]),
    confidence: confidenceFromFields([revenue, expenses, net_income]),
  };
}

export function extractBalanceSheetProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod } = ctxFrom(extraction, params);

  const assets = findLabeledAmount(text, [/total\s*assets?/i, /activos?/i]);
  const liabilities = findLabeledAmount(text, [
    /total\s*liabilit/i,
    /pasivos?/i,
  ]);
  const equity = findLabeledAmount(text, [/equity/i, /patrimonio/i, /capital/i]);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    assets,
    liabilities,
    equity,
    source_document: titleHint,
  };

  return {
    documentType: "balance_sheet",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      assets != null ? `Activos: $${assets.toLocaleString()}` : null,
      equity != null ? `Patrimonio: $${equity.toLocaleString()}` : null,
    ]),
    confidence: confidenceFromFields([assets, liabilities, equity]),
  };
}

export function extractBankReconciliationProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod, uploadDate } = ctxFrom(
    extraction,
    params,
  );

  const bank_balance = findLabeledAmount(text, [
    /bank\s*balance/i,
    /saldo\s*bancario/i,
  ]);
  const book_balance = findLabeledAmount(text, [
    /book\s*balance/i,
    /saldo\s*contable/i,
  ]);
  const difference =
    findLabeledAmount(text, [/difference/i, /diferencia/i, /variance/i]) ??
    (bank_balance != null && book_balance != null
      ? bank_balance - book_balance
      : null);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    bank_balance,
    book_balance,
    difference,
    source_document: titleHint,
    upload_date: uploadDate,
  };

  return {
    documentType: "bank_reconciliation",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      difference != null ? `Diferencia: $${difference.toLocaleString()}` : null,
    ]),
    confidence: confidenceFromFields([bank_balance, book_balance, difference]),
  };
}

export function extractBankStatementProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod, uploadDate } = ctxFrom(
    extraction,
    params,
  );

  const opening_balance = findLabeledAmount(text, [
    /opening\s*balance/i,
    /saldo\s*inicial/i,
  ]);
  const closing_balance = findLabeledAmount(text, [
    /closing\s*balance/i,
    /ending\s*balance/i,
    /saldo\s*final/i,
  ]);
  const transaction_count = countMatches(
    text,
    /\b(deposit|withdrawal|check|payment|transfer|cargo|abono)\b/i,
  );

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    opening_balance,
    closing_balance,
    transaction_count,
    source_document: titleHint,
    upload_date: uploadDate,
  };

  return {
    documentType: "bank_statement",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      closing_balance != null
        ? `Saldo final: $${closing_balance.toLocaleString()}`
        : null,
    ]),
    confidence: confidenceFromFields([
      opening_balance,
      closing_balance,
      transaction_count,
    ]),
  };
}

export function extractCustomReportProfile(
  extraction: ExtractionResult,
  params: Omit<ExtractorContext, "text">,
): ExtractionProfileResult {
  const { text, titleHint, fallbackPeriod, uploadDate } = ctxFrom(
    extraction,
    params,
  );

  const total_amount = findLabeledAmount(text, [/total/i, /grand\s*total/i]);
  const row_count = extraction.meta.rowCount ?? countMatches(text, /\n/g);

  const structuredData = {
    company: null,
    period: fallbackPeriod,
    label: titleHint,
    total_amount,
    row_count,
    source_document: titleHint,
    upload_date: uploadDate,
  };

  return {
    documentType: "custom_aging",
    period: fallbackPeriod,
    structuredData,
    summary: buildSummary([
      total_amount != null ? `Total: $${total_amount.toLocaleString()}` : null,
    ]),
    confidence: confidenceFromFields([total_amount, row_count]),
  };
}
