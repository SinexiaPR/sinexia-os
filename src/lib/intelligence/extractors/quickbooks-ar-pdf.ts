import { parseMoney } from "@/lib/intelligence/extractors/base";
import type {
  QuickBooksARCustomer,
  QuickBooksARInvoice,
} from "@/lib/intelligence/extractors/quickbooks-ar";

const SKIP_LINE =
  /^(page\s+\d+\s+of\s+\d+|page\s+\d+|generated:|printed:|quickbooks|intuit|\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?)$/i;

const REPORT_TITLE =
  /customer\s*balance\s*detail|accounts?\s*receivable|a\/r\s*aging|as\s+of|report\s+period|report\s+date|^\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–]\s*\d{1,2}\/\d{2,4}\/\d{2,4}$/i;

const TABLE_HEADER =
  /transaction\s*type/i;

const REPEATED_HEADER =
  /^(date|transaction\s*type|num|no\.?|due\s*date|open\s*balance|amount|balance)/i;

const CUSTOMER_TOTAL = /^Total for\s+(.+?)\s+\$?\s*([\d,]+\.\d{2})\s*$/i;

const GRAND_TOTAL = /^TOTAL\s+\$?\s*([\d,]+\.\d{2})\s*$/i;

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

function isSkipLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (SKIP_LINE.test(trimmed)) return true;
  if (REPORT_TITLE.test(trimmed)) return true;
  if (/^©|^copyright/i.test(trimmed)) return true;
  return false;
}

function parseInvoiceLine(line: string): QuickBooksARInvoice | null {
  const trimmed = line.trim();
  if (!/\binvoice\b/i.test(trimmed) || /^total/i.test(trimmed)) return null;

  const moneyMatch = trimmed.match(/\$?\s*([\d,]+\.\d{2})\s*$/);
  if (!moneyMatch) return null;
  const open_balance = parseMoney(moneyMatch[1]);
  if (open_balance == null) return null;

  const dates = [...trimmed.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g)].map(
    (match) => match[1],
  );
  if (!dates.length) return null;

  const invoiceMatch = trimmed.match(/\bInvoice\s+(\S+)/i);
  const invoice_number = invoiceMatch?.[1] ?? null;

  return {
    invoice_number,
    invoice_date: parseDateToken(dates[0] ?? null),
    due_date: parseDateToken(dates[1] ?? null),
    open_balance,
    current: null,
    days_1_30: null,
    days_31_60: null,
    days_61_90: null,
    days_90_plus: null,
  };
}

function looksLikeCustomerLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isSkipLine(trimmed)) return false;
  if (TABLE_HEADER.test(trimmed) || REPEATED_HEADER.test(trimmed)) return false;
  if (/^total/i.test(trimmed)) return false;
  if (parseInvoiceLine(trimmed)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) return false;
  if (/^\$?\s*[\d,]+\.\d{2}\s*$/.test(trimmed)) return false;
  if (trimmed.length < 2 || trimmed.length > 120) return false;
  return /[A-Za-zÁÉÍÓÚáéíóú]/.test(trimmed);
}

function finalizeCustomer(customer: QuickBooksARCustomer) {
  if (customer.balance <= 0 && customer.invoices.length > 0) {
    customer.balance = Number(
      customer.invoices
        .reduce((sum, invoice) => sum + (invoice.open_balance ?? 0), 0)
        .toFixed(2),
    );
  }
  customer.invoice_count = customer.invoices.length;
  for (const invoice of customer.invoices) {
    const candidate = invoice.invoice_date ?? invoice.due_date;
    if (!candidate) continue;
    if (!customer.oldest_invoice || candidate < customer.oldest_invoice) {
      customer.oldest_invoice = candidate;
    }
  }
}

export function parseCustomerBalanceDetailPdfText(text: string): {
  customers: QuickBooksARCustomer[];
  grandTotal: number | null;
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!lines.some((line) => TABLE_HEADER.test(line))) {
    return { customers: [], grandTotal: null };
  }

  const reportCompany = (() => {
    for (const line of lines.slice(0, 20)) {
      if (isSkipLine(line) || TABLE_HEADER.test(line)) continue;
      if (/quickbooks|customer balance|report|page|as of|period/i.test(line)) {
        continue;
      }
      if (
        line.length >= 3 &&
        line.length <= 80 &&
        !/^\d/.test(line) &&
        /[A-Za-z]/.test(line)
      ) {
        return line;
      }
    }
    return null;
  })();

  const customers: QuickBooksARCustomer[] = [];
  const customerIndex = new Map<string, QuickBooksARCustomer>();
  let currentCustomer: QuickBooksARCustomer | null = null;
  let grandTotal: number | null = null;
  let passedHeader = false;

  for (const line of lines) {
    if (isSkipLine(line)) continue;
    if (
      reportCompany &&
      line.toLowerCase() === reportCompany.toLowerCase()
    ) {
      continue;
    }

    if (TABLE_HEADER.test(line) || REPEATED_HEADER.test(line)) {
      passedHeader = true;
      continue;
    }

    if (!passedHeader) continue;

    const grandMatch = line.match(GRAND_TOTAL);
    if (grandMatch) {
      grandTotal = parseMoney(grandMatch[1]);
      currentCustomer = null;
      continue;
    }

    const customerTotalMatch = line.match(CUSTOMER_TOTAL);
    if (customerTotalMatch) {
      const name = customerTotalMatch[1].trim();
      const total = parseMoney(customerTotalMatch[2]);
      let customer = customerIndex.get(name.toLowerCase());
      if (!customer) {
        customer = {
          name,
          invoice_count: 0,
          balance: total ?? 0,
          oldest_invoice: null,
          current: null,
          days_1_30: null,
          days_31_60: null,
          days_61_90: null,
          days_90_plus: null,
          invoices: [],
        };
        customerIndex.set(name.toLowerCase(), customer);
        customers.push(customer);
      } else if (total != null) {
        customer.balance = total;
      }
      currentCustomer = customer;
      continue;
    }

    const invoice = parseInvoiceLine(line);
    if (invoice) {
      if (!currentCustomer) continue;
      currentCustomer.invoices.push(invoice);
      continue;
    }

    if (looksLikeCustomerLine(line)) {
      const existing = customerIndex.get(line.toLowerCase());
      if (existing) {
        currentCustomer = existing;
        continue;
      }

      currentCustomer = {
        name: line,
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
      customerIndex.set(line.toLowerCase(), currentCustomer);
      customers.push(currentCustomer);
    }
  }

  const parsedCustomers = customers
    .filter((customer) => customer.name && !/^total/i.test(customer.name))
    .map((customer) => {
      finalizeCustomer(customer);
      return customer;
    })
    .filter((customer) => customer.invoice_count > 0 || customer.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  if (grandTotal == null && parsedCustomers.length) {
    grandTotal = Number(
      parsedCustomers.reduce((sum, customer) => sum + customer.balance, 0).toFixed(2),
    );
  }

  return { customers: parsedCustomers, grandTotal };
}

export function extractGrandTotalFromPdfText(text: string): number | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    if (/^TOTAL\b/i.test(line) && !/^Total for/i.test(line)) {
      const match = line.match(/\$?\s*([\d,]+\.\d{2})\s*$/);
      if (match) return parseMoney(match[1]);
    }
  }

  return (
    parseMoney(
      text.match(
        /(?:total\s*(?:for\s*all\s*customers|receivable|open\s*balance)|grand\s*total)[^\n\d]{0,30}([\d,.]+(?:\.\d{2})?)/i,
      )?.[1] ?? null,
    ) ?? null
  );
}
