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

type MutableCustomer = QuickBooksARCustomer & {
  balanceFromSubtotal?: boolean;
};

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

function extractMoneyValues(line: string): number[] {
  const values: number[] = [];
  for (const match of line.matchAll(/\$?\s*([\d,]+\.\d{2})/g)) {
    const parsed = parseMoney(match[1]);
    if (parsed != null) values.push(parsed);
  }
  return values;
}

/** QuickBooks detail rows: AMOUNT, OPEN BALANCE, running BALANCE (last). */
function splitInvoiceMoneyColumns(monies: number[]): {
  amount: number | null;
  open_balance: number | null;
  running_balance: number | null;
} {
  if (!monies.length) {
    return { amount: null, open_balance: null, running_balance: null };
  }
  if (monies.length >= 3) {
    return {
      amount: monies[monies.length - 3] ?? null,
      open_balance: monies[monies.length - 2] ?? null,
      running_balance: monies[monies.length - 1] ?? null,
    };
  }
  if (monies.length === 2) {
    return {
      amount: monies[0] ?? null,
      open_balance: monies[1] ?? null,
      running_balance: null,
    };
  }
  return {
    amount: null,
    open_balance: monies[0] ?? null,
    running_balance: null,
  };
}

/** Subtotal / TOTAL rows may repeat the same value in every money column — take one. */
function pickAuthoritativeMoney(monies: number[]): number | null {
  if (!monies.length) return null;
  const unique = [...new Set(monies.map((value) => Number(value.toFixed(2))))];
  if (unique.length === 1) return unique[0] ?? null;
  return monies[monies.length - 1] ?? null;
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

  const dates = [...trimmed.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g)].map(
    (match) => match[1],
  );
  if (!dates.length) return null;

  const monies = extractMoneyValues(trimmed);
  const { amount, open_balance, running_balance } = splitInvoiceMoneyColumns(
    monies,
  );
  if (open_balance == null) return null;

  const invoiceMatch = trimmed.match(/\bInvoice\s+(\S+)/i);

  return {
    invoice_number: invoiceMatch?.[1] ?? null,
    invoice_date: parseDateToken(dates[0] ?? null),
    due_date: parseDateToken(dates[1] ?? null),
    amount,
    open_balance,
    running_balance,
    current: null,
    days_1_30: null,
    days_31_60: null,
    days_61_90: null,
    days_90_plus: null,
  };
}

function parseCustomerSubtotalLine(
  line: string,
): { name: string; total: number } | null {
  const match = line.match(/^Total for\s+(.+)$/i);
  if (!match) return null;

  const rest = match[1].trim();
  const monies = extractMoneyValues(rest);
  const total = pickAuthoritativeMoney(monies);
  if (total == null) return null;

  const firstMoneyIdx = rest.search(/\$?\s*[\d,]+\.\d{2}/);
  const name =
    firstMoneyIdx > 0 ? rest.slice(0, firstMoneyIdx).trim() : rest.trim();
  if (!name) return null;

  return { name, total };
}

function parseGrandTotalLine(line: string): number | null {
  if (!/^TOTAL\b/i.test(line.trim()) || /^Total for/i.test(line)) return null;
  return pickAuthoritativeMoney(extractMoneyValues(line));
}

function looksLikeCustomerLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isSkipLine(trimmed)) return false;
  if (TABLE_HEADER.test(trimmed) || REPEATED_HEADER.test(trimmed)) return false;
  if (/^total/i.test(trimmed)) return false;
  if (parseInvoiceLine(trimmed)) return false;
  if (parseCustomerSubtotalLine(trimmed)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) return false;
  if (/^\$?\s*[\d,]+\.\d{2}\s*$/.test(trimmed)) return false;
  if (trimmed.length < 2 || trimmed.length > 120) return false;
  return /[A-Za-zÁÉÍÓÚáéíóú]/.test(trimmed);
}

function finalizeCustomer(customer: MutableCustomer) {
  customer.invoice_count = customer.invoices.length;

  if (!customer.balanceFromSubtotal && customer.invoices.length > 0) {
    customer.balance = Number(
      customer.invoices
        .reduce((sum, invoice) => sum + (invoice.open_balance ?? 0), 0)
        .toFixed(2),
    );
  }

  for (const invoice of customer.invoices) {
    const candidate = invoice.due_date ?? invoice.invoice_date;
    if (!candidate) continue;
    if (!customer.oldest_invoice || candidate < customer.oldest_invoice) {
      customer.oldest_invoice = candidate;
    }
  }
}

export function resolveTotalReceivable(params: {
  reportGrandTotal: number | null;
  customers: QuickBooksARCustomer[];
}): number | null {
  if (params.reportGrandTotal != null) {
    return params.reportGrandTotal;
  }

  const subtotalCustomers = params.customers.filter(
    (customer) => (customer as MutableCustomer).balanceFromSubtotal,
  );
  if (
    subtotalCustomers.length > 0 &&
    subtotalCustomers.length === params.customers.length
  ) {
    return Number(
      subtotalCustomers
        .reduce((sum, customer) => sum + customer.balance, 0)
        .toFixed(2),
    );
  }

  if (params.customers.length) {
    return Number(
      params.customers
        .reduce((sum, customer) => sum + customer.balance, 0)
        .toFixed(2),
    );
  }

  return null;
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

  const customers: MutableCustomer[] = [];
  const customerIndex = new Map<string, MutableCustomer>();
  let currentCustomer: MutableCustomer | null = null;
  let reportGrandTotal: number | null = null;
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

    const grandTotal = parseGrandTotalLine(line);
    if (grandTotal != null) {
      reportGrandTotal = grandTotal;
      currentCustomer = null;
      continue;
    }

    const customerSubtotal = parseCustomerSubtotalLine(line);
    if (customerSubtotal) {
      let customer = customerIndex.get(customerSubtotal.name.toLowerCase());
      if (!customer) {
        customer = {
          name: customerSubtotal.name,
          invoice_count: 0,
          balance: Number(customerSubtotal.total.toFixed(2)),
          balanceFromSubtotal: true,
          oldest_invoice: null,
          current: null,
          days_1_30: null,
          days_31_60: null,
          days_61_90: null,
          days_90_plus: null,
          invoices: [],
        };
        customerIndex.set(customerSubtotal.name.toLowerCase(), customer);
        customers.push(customer);
      } else {
        customer.balance = Number(customerSubtotal.total.toFixed(2));
        customer.balanceFromSubtotal = true;
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
        balanceFromSubtotal: false,
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
      const { balanceFromSubtotal: _flag, ...publicCustomer } = customer;
      return publicCustomer;
    })
    .filter((customer) => customer.invoice_count > 0 || customer.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const grandTotal = resolveTotalReceivable({
    reportGrandTotal,
    customers: parsedCustomers,
  });

  return { customers: parsedCustomers, grandTotal };
}

export function extractGrandTotalFromPdfText(text: string): number | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const total = parseGrandTotalLine(lines[i] ?? "");
    if (total != null) return total;
  }

  return (
    parseMoney(
      text.match(
        /(?:total\s*(?:for\s*all\s*customers|receivable|open\s*balance)|grand\s*total)[^\n\d]{0,30}([\d,.]+(?:\.\d{2})?)/i,
      )?.[1] ?? null,
    ) ?? null
  );
}
