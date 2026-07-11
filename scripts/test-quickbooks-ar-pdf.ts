import {
  buildQuickBooksARAnalyticalSummary,
  detectQuickBooksAR,
  extractQuickBooksARProfile,
} from "@/lib/intelligence/extractors/quickbooks-ar";
import { detectQueryIntent } from "@/lib/intelligence/intents";
import { parseCustomerBalanceDetailPdfText } from "@/lib/intelligence/extractors/quickbooks-ar-pdf";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function invoiceLine(
  date: string,
  num: string,
  dueDate: string,
  amount: number,
  openBalance: number,
  runningBalance: number,
): string {
  return `${date} Invoice ${num} ${dueDate} ${amount.toFixed(2)} ${openBalance.toFixed(2)} ${runningBalance.toFixed(2)}`;
}

function customerTotal(name: string, total: number): string {
  return `Total for ${name} ${total.toFixed(2)} ${total.toFixed(2)} ${total.toFixed(2)}`;
}

const SAMPLE_QB_PDF_TEXT = `
Wagyu Food Service LLC
Customer Balance Detail Report - New
As of March 31, 2026

Date Transaction Type Num Due Date Amount Open Balance Balance
MARMALADE CORP
${invoiceLine("1/10/2026", "1041", "2/9/2026", 2500, 2500, 2500)}
${invoiceLine("2/5/2026", "1088", "3/7/2026", 2500, 2500, 5000)}
${invoiceLine("3/1/2026", "1120", "3/31/2026", 2534.42, 2534.42, 7534.42)}
${customerTotal("MARMALADE CORP", 7534.42)}

LA BRAZA SMOKE HOUSE
${invoiceLine("1/15/2026", "2010", "2/14/2026", 1206.38, 1206.38, 1206.38)}
${invoiceLine("2/20/2026", "2055", "3/22/2026", 1000, 1000, 2206.38)}
${customerTotal("LA BRAZA SMOKE HOUSE", 2206.38)}

RARE 125 REST
${invoiceLine("1/20/2026", "3011", "2/19/2026", 700, 700, 700)}
${invoiceLine("3/5/2026", "3099", "4/4/2026", 637.62, 637.62, 1337.62)}
${customerTotal("RARE 125 REST", 1337.62)}

BARDOT REST.
${invoiceLine("2/1/2026", "4010", "3/3/2026", 631.99, 631.99, 631.99)}
${invoiceLine("2/28/2026", "4044", "3/30/2026", 600, 600, 1231.99)}
${customerTotal("BARDOT REST.", 1231.99)}

OAK CAFE
${invoiceLine("3/8/2026", "5010", "4/7/2026", 400, 400, 400)}
${customerTotal("OAK CAFE", 400)}

HARBOR DINER
${invoiceLine("3/12/2026", "6010", "4/11/2026", 343.17, 343.17, 343.17)}
${customerTotal("HARBOR DINER", 343.17)}

SUNSET GRILL
${invoiceLine("3/15/2026", "7010", "4/14/2026", 350, 350, 350)}
${customerTotal("SUNSET GRILL", 350)}

COASTAL BISTRO
${invoiceLine("3/18/2026", "8010", "4/17/2026", 250, 250, 250)}
${customerTotal("COASTAL BISTRO", 250)}

TOTAL 13653.58 13653.58 13653.58

Page 2 of 2
Generated 3/31/2026 10:15 AM
Wagyu Food Service LLC
Customer Balance Detail Report
Date Transaction Type Num Due Date Amount Open Balance Balance
`;

function runDetectionTest() {
  const variant = detectQuickBooksAR(
    SAMPLE_QB_PDF_TEXT,
    "customer-balance-detail.pdf",
    "Customer Balance Detail Report - New",
  );
  assert(variant === "customer_balance_detail", "expected customer_balance_detail");
}

function runPdfParserTest() {
  const parsed = parseCustomerBalanceDetailPdfText(SAMPLE_QB_PDF_TEXT);
  assert(parsed.customers.length === 8, "expected 8 customers");
  assert(
    parsed.grandTotal === 13653.58,
    `expected grand total 13653.58, got ${parsed.grandTotal}`,
  );

  const invoiceCount = parsed.customers.reduce(
    (sum, customer) => sum + customer.invoice_count,
    0,
  );
  assert(invoiceCount === 13, `expected 13 invoices, got ${invoiceCount}`);

  const marmalade = parsed.customers.find((customer) =>
    /MARMALADE/i.test(customer.name),
  );
  assert(marmalade?.balance === 7534.42, "MARMALADE CORP balance should be 7534.42");

  const openBalanceSum = parsed.customers.reduce(
    (sum, customer) =>
      sum +
      customer.invoices.reduce(
        (inner, invoice) => inner + (invoice.open_balance ?? 0),
        0,
      ),
    0,
  );
  const runningBalanceSum = parsed.customers.reduce(
    (sum, customer) =>
      sum +
      customer.invoices.reduce(
        (inner, invoice) => inner + (invoice.running_balance ?? 0),
        0,
      ),
    0,
  );
  assert(
    runningBalanceSum > openBalanceSum,
    "running balances should not be used as open balances",
  );
  assert(
    parsed.grandTotal !== runningBalanceSum,
    "grand total must not equal summed running balances",
  );

  const customerSubtotalSum = parsed.customers.reduce(
    (sum, customer) => sum + customer.balance,
    0,
  );
  assert(
    Math.abs(customerSubtotalSum - 13653.58) < 0.01,
    `unique customer subtotals must sum to grand total, got ${customerSubtotalSum}`,
  );

  const topNames = parsed.customers.slice(0, 4).map((customer) => customer.name);
  assert(/MARMALADE/i.test(topNames[0] ?? ""), "top customer should be MARMALADE CORP");
  assert(parsed.customers[0]?.balance === 7534.42, "top balance 7534.42");
  assert(parsed.customers[1]?.balance === 2206.38, "second balance 2206.38");
  assert(parsed.customers[2]?.balance === 1337.62, "third balance 1337.62");
  assert(parsed.customers[3]?.balance === 1231.99, "fourth balance 1231.99");
}

function runProfileExtractionTest() {
  const profile = extractQuickBooksARProfile(
    {
      text: SAMPLE_QB_PDF_TEXT,
      chunks: [],
      requiresOcr: false,
      meta: { format: "pdf" },
    },
    {
      filename: "customer-balance-detail.pdf",
      titleHint: "Customer Balance Detail Report - New",
      fallbackPeriod: "2026-03",
      uploadDate: new Date().toISOString(),
    },
  );

  assert(profile != null, "profile should not be null");
  assert(profile!.structuredData.customer_count === 8, "expected 8 customers");
  assert(profile!.structuredData.invoice_count === 13, "expected 13 invoices");
  assert(
    profile!.structuredData.total_receivable === 13653.58,
    "expected total receivable 13653.58",
  );
  assert(profile!.confidence >= 0.35, "confidence should meet processing threshold");
}

function runSummaryTest() {
  const profile = extractQuickBooksARProfile(
    {
      text: SAMPLE_QB_PDF_TEXT,
      chunks: [],
      requiresOcr: false,
      meta: { format: "pdf" },
    },
    {
      filename: "customer-balance-detail.pdf",
      titleHint: "Customer Balance Detail Report - New",
      fallbackPeriod: "2026-03",
      uploadDate: new Date().toISOString(),
    },
  )!;

  const summary = buildQuickBooksARAnalyticalSummary(
    profile.structuredData as Parameters<typeof buildQuickBooksARAnalyticalSummary>[0],
  );

  assert(summary.includes("13,653.58"), "summary should include total outstanding");
  assert(summary.includes("8 clientes"), "summary should include customer count");
  assert(summary.includes("13 facturas"), "summary should include invoice count");
  assert(summary.includes("MARMALADE CORP"), "summary should mention top customer");
  assert(summary.includes("Customer Balance Detail Report - New"), "summary should cite source");
}

function runIntentDetectionTest() {
  assert(
    detectQueryIntent("¿Cuánto me deben?") === "receivable_total",
    "debts question should map to receivable_total",
  );
  assert(
    detectQueryIntent("Resumime este reporte.") === "summary",
    "resumime should map to summary",
  );
  assert(
    detectQueryIntent("Analizame las cuentas por cobrar.") === "summary",
    "analizame AR should map to summary",
  );
}

runDetectionTest();
runPdfParserTest();
runProfileExtractionTest();
runSummaryTest();
runIntentDetectionTest();
console.log("QUICKBOOKS AR PDF TEST PASS");
