import { parseMoney, confidenceFromFields, buildSummary } from "@/lib/intelligence/extractors/base";
import {
  extractGrandTotalFromPdfText,
  parseCustomerBalanceDetailPdfText,
} from "@/lib/intelligence/extractors/quickbooks-ar-pdf";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";
import type { ExtractionResult } from "@/lib/intelligence/types";

function logQuickBooksAR(event: string, meta: Record<string, unknown>) {
  console.info(`[sinexia-qb-ar] ${event}`, meta);
}

export type QuickBooksARVariant =
  | "customer_balance_detail"
  | "ar_aging"
  | "customer_balance_summary"
  | null;

export type QuickBooksARInvoice = {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  open_balance: number | null;
  current: number | null;
  days_1_30: number | null;
  days_31_60: number | null;
  days_61_90: number | null;
  days_90_plus: number | null;
};

export type QuickBooksARCustomer = {
  name: string;
  invoice_count: number;
  balance: number;
  oldest_invoice: string | null;
  current: number | null;
  days_1_30: number | null;
  days_31_60: number | null;
  days_61_90: number | null;
  days_90_plus: number | null;
  invoices: QuickBooksARInvoice[];
};

export type QuickBooksARProfile = {
  kind: "quickbooks_ar";
  variant: Exclude<QuickBooksARVariant, null>;
  company: string | null;
  period: string | null;
  report_date: string | null;
  currency: string | null;
  source_system: "QuickBooks";
  customer_count: number | null;
  invoice_count: number | null;
  total_receivable: number | null;
  grand_total: number | null;
  current: number | null;
  days_1_30: number | null;
  days_31_60: number | null;
  days_61_90: number | null;
  days_90_plus: number | null;
  customers: QuickBooksARCustomer[];
  source_document: string | null;
  upload_date: string | null;
  original_filename: string | null;
};

const QB_AR_PATTERNS = [
  /customer\s*balance\s*detail/i,
  /accounts?\s*receivable\s*aging/i,
  /a\/r\s*aging/i,
  /ar\s*aging/i,
  /customer\s*balance\s*summary/i,
  /aging\s*summary/i,
  /open\s*invoices?\s*by\s*customer/i,
];

const QB_HINTS = [/quickbooks/i, /\bQB\b/, /intuit/i];

const AGING_HINTS = [
  /1\s*[-–]\s*30/i,
  /31\s*[-–]\s*60/i,
  /61\s*[-–]\s*90/i,
  /90\s*\+/i,
  />\s*90/i,
  /current/i,
  /open\s*balance/i,
];

type ExtractorParams = {
  filename: string;
  titleHint: string;
  fallbackPeriod: string | null;
  uploadDate: string;
};

function detectVariant(haystack: string): QuickBooksARVariant {
  if (/customer\s*balance\s*detail/i.test(haystack)) {
    return "customer_balance_detail";
  }
  if (/customer\s*balance\s*summary/i.test(haystack)) {
    return "customer_balance_summary";
  }
  if (
    /accounts?\s*receivable\s*aging|a\/r\s*aging|ar\s*aging|aging\s*summary/i.test(
      haystack,
    )
  ) {
    return "ar_aging";
  }
  if (
    AGING_HINTS.filter((p) => p.test(haystack)).length >= 3 &&
    (/customer/i.test(haystack) || /receivable/i.test(haystack))
  ) {
    return "ar_aging";
  }
  return null;
}

export function detectQuickBooksAR(
  text: string,
  filename: string,
  titleHint?: string,
): QuickBooksARVariant {
  const haystack = `${filename}\n${titleHint ?? ""}\n${text}`.slice(0, 12_000);
  const looksLikeQbOrAging =
    QB_HINTS.some((p) => p.test(haystack)) ||
    QB_AR_PATTERNS.some((p) => p.test(haystack)) ||
    (AGING_HINTS.filter((p) => p.test(haystack)).length >= 3 &&
      /customer|receivable|invoice/i.test(haystack));

  if (!looksLikeQbOrAging) return null;
  return detectVariant(haystack) ?? "ar_aging";
}

function parseDateToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^total$/i.test(trimmed)) return null;
  const iso = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const mdy = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mdy) {
    const month = mdy[1].padStart(2, "0");
    const day = mdy[2].padStart(2, "0");
    let year = mdy[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }
  return trimmed.length <= 32 ? trimmed : null;
}

function extractCompanyName(text: string): string | null {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 25);
  for (const line of lines) {
    if (
      /quickbooks|customer balance|accounts receivable|aging|report|period|as of|page\s*\d/i.test(
        line,
      )
    ) {
      continue;
    }
    if (line.length >= 3 && line.length <= 80 && !/^\d/.test(line)) {
      return line.replace(/^===\s*Sheet:.*===\s*/i, "").trim() || null;
    }
  }
  return null;
}

function extractReportDate(text: string): string | null {
  const asOf = text.match(
    /as\s*of\s*[:\s]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (asOf?.[1]) return parseDateToken(asOf[1]) ?? asOf[1];
  const dateLabel = text.match(
    /(?:report\s*date|date)\s*[:\s]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  return dateLabel?.[1] ? parseDateToken(dateLabel[1]) ?? dateLabel[1] : null;
}

function extractPeriod(text: string, fallback: string | null): string | null {
  const period = text.match(
    /(?:period|for\s*the\s*period)\s*[:\s]*([^\n]{5,60})/i,
  );
  if (period?.[1]) return period[1].trim();
  return fallback;
}

function extractCurrency(text: string): string | null {
  if (/\$|USD|US\$/i.test(text)) return "USD";
  if (/€|EUR/i.test(text)) return "EUR";
  if (/£|GBP/i.test(text)) return "GBP";
  return null;
}

type HeaderMap = {
  customer?: number;
  invoice?: number;
  invoiceDate?: number;
  dueDate?: number;
  openBalance?: number;
  current?: number;
  d1_30?: number;
  d31_60?: number;
  d61_90?: number;
  d90?: number;
  total?: number;
};

function mapHeaders(headers: string[]): HeaderMap | null {
  const map: HeaderMap = {};
  headers.forEach((h, idx) => {
    const n = h.toLowerCase().replace(/\s+/g, " ").trim();
    if (/^customer|^name$|client/i.test(n) && map.customer == null) {
      map.customer = idx;
    } else if (/invoice\s*(#|no|num)|num(ero)?\s*factura|^type$/i.test(n)) {
      map.invoice = idx;
    } else if (/invoice\s*date|^date$|fecha/i.test(n) && map.invoiceDate == null) {
      map.invoiceDate = idx;
    } else if (/due\s*date|vencim/i.test(n)) {
      map.dueDate = idx;
    } else if (/open\s*balance|amount\s*due|balance\s*due|^amount$/i.test(n)) {
      map.openBalance = idx;
    } else if (/^current$|0\s*[-–]\s*30|current\s*\(/i.test(n)) {
      map.current = idx;
    } else if (/1\s*[-–]\s*30|1\s*to\s*30/i.test(n)) {
      map.d1_30 = idx;
    } else if (/31\s*[-–]\s*60|31\s*to\s*60/i.test(n)) {
      map.d31_60 = idx;
    } else if (/61\s*[-–]\s*90|61\s*to\s*90/i.test(n)) {
      map.d61_90 = idx;
    } else if (/90\s*\+|91|over\s*90|>\s*90|more\s*than\s*90/i.test(n)) {
      map.d90 = idx;
    } else if (/^total$|grand\s*total|total\s*balance/i.test(n)) {
      map.total = idx;
    }
  });

  const hasCustomer = map.customer != null;
  const hasAmount =
    map.openBalance != null ||
    map.total != null ||
    map.current != null ||
    map.d1_30 != null ||
    map.d31_60 != null ||
    map.d61_90 != null ||
    map.d90 != null;
  if (!hasCustomer || !hasAmount) return null;
  return map;
}

function cell(row: string[], idx: number | undefined): string {
  if (idx == null || idx < 0 || idx >= row.length) return "";
  return (row[idx] ?? "").trim();
}

function moneyAt(row: string[], idx: number | undefined): number | null {
  return parseMoney(cell(row, idx) || null);
}

function parsePipeRows(text: string): { headers: string[]; rows: string[][] }[] {
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const headerBlocks = text.split(/(?:Headers:\s*|CSV Headers:\s*)/i);

  for (let i = 1; i < headerBlocks.length; i++) {
    const block = headerBlocks[i];
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const headerLine = lines[0].replace(/^Sheet:.*$/i, "").trim();
    const headers = headerLine.split("|").map((h) => h.trim());
    if (headers.length < 2) continue;

    const rows: string[][] = [];
    for (const line of lines.slice(1)) {
      const cleaned = line.replace(/^R\d+:\s*/i, "").trim();
      if (!cleaned || /^===/.test(cleaned)) break;
      if (/^Sheet:/i.test(cleaned) || /^Headers:/i.test(cleaned)) break;
      rows.push(cleaned.split("|").map((c) => c.trim()));
    }
    if (rows.length) tables.push({ headers, rows });
  }

  // Fallback: split whole text by pipes if no Headers: markers
  if (!tables.length && text.includes("|")) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const headerIdx = lines.findIndex((l) =>
      /customer|current|1\s*[-–]\s*30|open\s*balance/i.test(l) &&
      l.includes("|"),
    );
    if (headerIdx >= 0) {
      const headers = lines[headerIdx].split("|").map((h) => h.trim());
      const rows = lines
        .slice(headerIdx + 1, headerIdx + 2001)
        .filter((l) => l.includes("|"))
        .map((l) => l.replace(/^R\d+:\s*/i, "").split("|").map((c) => c.trim()));
      if (rows.length) tables.push({ headers, rows });
    }
  }

  return tables;
}

function isTotalRow(name: string): boolean {
  return /^(total|totals|grand total|total customers?)$/i.test(name.trim());
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return null;
  return Number(nums.reduce((a, b) => a + b, 0).toFixed(2));
}

function buildCustomersFromTable(
  headers: string[],
  rows: string[][],
): {
  customers: QuickBooksARCustomer[];
  grandTotal: number | null;
} {
  const map = mapHeaders(headers);
  if (!map) return { customers: [], grandTotal: null };

  const byName = new Map<string, QuickBooksARCustomer>();
  let grandTotal: number | null = null;
  let currentCustomer: string | null = null;

  for (const row of rows) {
    const rawName = cell(row, map.customer);
    const invoice = cell(row, map.invoice);
    const looksLikeInvoice =
      Boolean(invoice) && !isTotalRow(invoice) && !/^customer$/i.test(invoice);

    if (rawName && !isTotalRow(rawName)) {
      currentCustomer = rawName;
    } else if (!rawName && currentCustomer && looksLikeInvoice) {
      // detail line under customer
    } else if (isTotalRow(rawName) || /^total$/i.test(invoice)) {
      const totalVal =
        moneyAt(row, map.total) ??
        moneyAt(row, map.openBalance) ??
        sumNullable([
          moneyAt(row, map.current),
          moneyAt(row, map.d1_30),
          moneyAt(row, map.d31_60),
          moneyAt(row, map.d61_90),
          moneyAt(row, map.d90),
        ]);
      if (/grand/i.test(rawName) || /grand/i.test(invoice)) {
        grandTotal = totalVal;
      }
      continue;
    }

    const customerName = rawName && !isTotalRow(rawName) ? rawName : currentCustomer;
    if (!customerName) continue;

    let customer = byName.get(customerName);
    if (!customer) {
      customer = {
        name: customerName,
        invoice_count: 0,
        balance: 0,
        oldest_invoice: null,
        current: null,
        days_1_30: null,
        days_31_60: null,
        days_61_90: null,
        days_90_plus: null,
        invoices: [],
      };
      byName.set(customerName, customer);
    }

    const inv: QuickBooksARInvoice = {
      invoice_number: looksLikeInvoice ? invoice : null,
      invoice_date: parseDateToken(cell(row, map.invoiceDate)),
      due_date: parseDateToken(cell(row, map.dueDate)),
      open_balance: moneyAt(row, map.openBalance),
      current: moneyAt(row, map.current),
      days_1_30: moneyAt(row, map.d1_30),
      days_31_60: moneyAt(row, map.d31_60),
      days_61_90: moneyAt(row, map.d61_90),
      days_90_plus: moneyAt(row, map.d90),
    };

    const lineBalance =
      inv.open_balance ??
      moneyAt(row, map.total) ??
      sumNullable([
        inv.current,
        inv.days_1_30,
        inv.days_31_60,
        inv.days_61_90,
        inv.days_90_plus,
      ]);

    // Summary-only row (customer + totals, no invoice)
    if (!looksLikeInvoice && lineBalance != null) {
      customer.balance = lineBalance;
      customer.current = inv.current;
      customer.days_1_30 = inv.days_1_30;
      customer.days_31_60 = inv.days_31_60;
      customer.days_61_90 = inv.days_61_90;
      customer.days_90_plus = inv.days_90_plus;
      continue;
    }

    if (looksLikeInvoice || lineBalance != null) {
      if (looksLikeInvoice) {
        customer.invoices.push(inv);
        customer.invoice_count += 1;
      }
      if (lineBalance != null) {
        customer.balance = Number((customer.balance + lineBalance).toFixed(2));
      }
      customer.current = sumNullable([customer.current, inv.current]);
      customer.days_1_30 = sumNullable([customer.days_1_30, inv.days_1_30]);
      customer.days_31_60 = sumNullable([customer.days_31_60, inv.days_31_60]);
      customer.days_61_90 = sumNullable([customer.days_61_90, inv.days_61_90]);
      customer.days_90_plus = sumNullable([
        customer.days_90_plus,
        inv.days_90_plus,
      ]);

      const oldestCandidate = inv.invoice_date ?? inv.due_date;
      if (oldestCandidate) {
        if (
          !customer.oldest_invoice ||
          oldestCandidate < customer.oldest_invoice
        ) {
          customer.oldest_invoice = oldestCandidate;
        }
      }
    }
  }

  const customers = [...byName.values()]
    .filter((c) => c.name && !isTotalRow(c.name) && (c.balance > 0 || c.invoice_count > 0))
    .sort((a, b) => b.balance - a.balance);

  if (grandTotal == null && customers.length) {
    grandTotal = Number(
      customers.reduce((acc, c) => acc + (c.balance || 0), 0).toFixed(2),
    );
  }

  return { customers, grandTotal };
}

function parseExcelBuffer(buffer: Buffer): {
  headers: string[];
  rows: string[][];
}[] {
  try {
    // Dynamic import keeps this optional for CSV/PDF text-only paths
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: true,
    });
    const tables: { headers: string[]; rows: string[][] }[] = [];

    for (const sheetName of workbook.SheetNames.slice(0, 10)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];
      if (!matrix.length) continue;

      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(matrix.length, 40); i++) {
        const cells = (matrix[i] ?? []).map((c) => String(c ?? "").trim());
        if (mapHeaders(cells)) {
          headerRowIdx = i;
          break;
        }
      }
      if (headerRowIdx < 0) continue;

      const headers = (matrix[headerRowIdx] ?? []).map((c) =>
        String(c ?? "").trim(),
      );
      const rows = matrix
        .slice(headerRowIdx + 1, headerRowIdx + 2001)
        .map((r) =>
          (r ?? []).map((c) => {
            if (c instanceof Date) return c.toISOString().slice(0, 10);
            if (typeof c === "number") return String(c);
            return String(c ?? "").trim();
          }),
        )
        .filter((r) => r.some((c) => c));

      tables.push({ headers, rows });
    }
    return tables;
  } catch {
    return [];
  }
}

export function extractQuickBooksARProfile(
  extraction: ExtractionResult,
  params: ExtractorParams & { buffer?: Buffer | null },
): ExtractionProfileResult | null {
  const text = extraction.text;
  const variant = detectQuickBooksAR(text, params.filename, params.titleHint);
  if (!variant) {
    logQuickBooksAR("qb_ar_skipped", {
      reason: "no_variant_detected",
      extractedTextLength: text.length,
      filename: params.filename,
    });
    return null;
  }

  const isSpreadsheet = /\.xlsx?$/i.test(params.filename);
  let tables = params.buffer && isSpreadsheet ? parseExcelBuffer(params.buffer) : [];
  if (!tables.length) {
    tables = parsePipeRows(text);
  }

  let customers: QuickBooksARCustomer[] = [];
  let grandTotal: number | null = null;

  for (const table of tables) {
    const parsed = buildCustomersFromTable(table.headers, table.rows);
    if (parsed.customers.length > customers.length) {
      customers = parsed.customers;
      grandTotal = parsed.grandTotal;
    }
  }

  if (
    !customers.length &&
    (variant === "customer_balance_detail" ||
      /customer\s*balance\s*detail/i.test(text))
  ) {
    const pdfParsed = parseCustomerBalanceDetailPdfText(text);
    if (pdfParsed.customers.length) {
      customers = pdfParsed.customers;
      grandTotal = pdfParsed.grandTotal;
      logQuickBooksAR("qb_ar_pdf_table_parsed", {
        variant,
        customerCount: customers.length,
        invoiceCount: customers.reduce((sum, c) => sum + c.invoice_count, 0),
        totalReceivable: grandTotal,
      });
    }
  }

  // Fallback: labeled totals only
  if (!customers.length) {
    const total = extractGrandTotalFromPdfText(text);
    if (total == null) {
      logQuickBooksAR("qb_ar_parse_failed", {
        variant,
        extractedTextLength: text.length,
        filename: params.filename,
      });
      return null;
    }
    grandTotal = total;
  }

  const invoice_count = customers.reduce((a, c) => a + c.invoice_count, 0) || null;
  const customer_count = customers.length || null;
  const total_receivable = grandTotal;

  const bucketTotals = {
    current: sumNullable(customers.map((c) => c.current)),
    days_1_30: sumNullable(customers.map((c) => c.days_1_30)),
    days_31_60: sumNullable(customers.map((c) => c.days_31_60)),
    days_61_90: sumNullable(customers.map((c) => c.days_61_90)),
    days_90_plus: sumNullable(customers.map((c) => c.days_90_plus)),
  };

  const company = extractCompanyName(text);
  const report_date = extractReportDate(text);
  const period = extractPeriod(text, params.fallbackPeriod);
  const currency = extractCurrency(text);

  const structuredData: QuickBooksARProfile = {
    kind: "quickbooks_ar",
    variant,
    company,
    period,
    report_date,
    currency,
    source_system: "QuickBooks",
    customer_count,
    invoice_count,
    total_receivable,
    grand_total: grandTotal,
    current: bucketTotals.current,
    days_1_30: bucketTotals.days_1_30,
    days_31_60: bucketTotals.days_31_60,
    days_61_90: bucketTotals.days_61_90,
    days_90_plus: bucketTotals.days_90_plus,
    customers: customers.slice(0, 500),
    source_document: params.titleHint,
    upload_date: params.uploadDate,
    original_filename: params.filename,
  };

  const top = customers[0];
  const summary = buildSummary([
    total_receivable != null
      ? `Total receivable: $${total_receivable.toLocaleString()}`
      : null,
    customer_count != null ? `${customer_count} customers` : null,
    invoice_count != null ? `${invoice_count} invoices` : null,
    top ? `Top: ${top.name} ($${top.balance.toLocaleString()})` : null,
    report_date ? `As of ${report_date}` : period,
  ]);

  const confidence = confidenceFromFields([
    total_receivable,
    customer_count,
    invoice_count,
    customers.length ? customers.length : null,
    bucketTotals.current ?? bucketTotals.days_1_30,
    company,
    report_date ?? period,
  ]);

  logQuickBooksAR("qb_ar_profile_completed", {
    variant,
    extractedTextLength: text.length,
    detectedDocumentType: "accounts_receivable",
    customerCount: customer_count,
    invoiceCount: invoice_count,
    totalReceivable: total_receivable,
    structuredProfileGenerated: customers.length > 0 || total_receivable != null,
    confidence: Math.max(confidence, customers.length ? 0.7 : 0.4),
  });

  return {
    documentType: "accounts_receivable",
    period,
    structuredData: structuredData as unknown as Record<string, unknown>,
    summary,
    confidence: Math.max(confidence, customers.length ? 0.7 : 0.4),
  };
}

export function isQuickBooksARProfile(
  data: Record<string, unknown> | null | undefined,
): data is QuickBooksARProfile & Record<string, unknown> {
  return Boolean(data && data.kind === "quickbooks_ar");
}
