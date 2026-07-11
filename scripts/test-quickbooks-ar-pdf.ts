import {
  detectQuickBooksAR,
  extractQuickBooksARProfile,
} from "@/lib/intelligence/extractors/quickbooks-ar";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const SAMPLE_QB_PDF_TEXT = `
Wagyu Food Service LLC
Customer Balance Detail Report
As of March 31, 2026

Date Transaction Type Num Due Date Open Balance
Metro Provisions LLC
3/1/2026 Invoice 1001 3/31/2026 2,500.00
3/5/2026 Invoice 1002 4/4/2026 1,800.00
Total for Metro Provisions LLC 4,300.00

Harbor Foods Inc
3/2/2026 Invoice 2001 4/1/2026 1,200.00
3/8/2026 Invoice 2002 4/7/2026 900.00
Total for Harbor Foods Inc 2,100.00

Prime Cut Catering
3/3/2026 Invoice 3001 4/2/2026 1,500.00
Total for Prime Cut Catering 1,500.00

Downtown Bistro Group
3/4/2026 Invoice 4001 4/3/2026 800.00
3/10/2026 Invoice 4002 4/9/2026 650.00
Total for Downtown Bistro Group 1,450.00

Sunset Grill Co
3/6/2026 Invoice 5001 4/5/2026 1,100.00
Total for Sunset Grill Co 1,100.00

Coastal Market LLC
3/7/2026 Invoice 6001 4/6/2026 500.00
3/12/2026 Invoice 6002 4/11/2026 400.00
Total for Coastal Market LLC 900.00

River City Meats
3/9/2026 Invoice 7001 4/8/2026 1,200.00
3/15/2026 Invoice 7002 4/14/2026 303.58
Total for River City Meats 1,503.58

Oak Street Deli
3/11/2026 Invoice 8001 4/10/2026 800.00
Total for Oak Street Deli 800.00

TOTAL 13,653.58

Page 2 of 2
Generated 3/31/2026 10:15 AM
Wagyu Food Service LLC
Customer Balance Detail Report
Date Transaction Type Num Due Date Open Balance
`;

function runDetectionTest() {
  const variant = detectQuickBooksAR(
    SAMPLE_QB_PDF_TEXT,
    "customer-balance-detail.pdf",
    "Customer Balance Detail",
  );
  assert(variant === "customer_balance_detail", "expected customer_balance_detail");
}

function runPdfArExtractionTest() {
  const profile = extractQuickBooksARProfile(
    {
      text: SAMPLE_QB_PDF_TEXT,
      chunks: [],
      requiresOcr: false,
      meta: { format: "pdf" },
    },
    {
      filename: "customer-balance-detail.pdf",
      titleHint: "Customer Balance Detail",
      fallbackPeriod: "2026-03",
      uploadDate: new Date().toISOString(),
    },
  );

  assert(profile != null, "profile should not be null");
  assert(
    profile!.documentType === "accounts_receivable",
    "document type accounts_receivable",
  );
  assert(profile!.structuredData.customer_count === 8, "expected 8 customers");
  assert(profile!.structuredData.invoice_count === 13, "expected 13 invoices");
  assert(
    profile!.structuredData.total_receivable === 13653.58,
    "expected total receivable 13653.58",
  );
  assert(profile!.confidence >= 0.35, "confidence should meet processing threshold");
  assert(
    profile!.structuredData.kind === "quickbooks_ar",
    "expected quickbooks_ar kind",
  );
}

function runMultiPageHeaderTest() {
  const profile = extractQuickBooksARProfile(
    {
      text: SAMPLE_QB_PDF_TEXT,
      chunks: [],
      requiresOcr: false,
      meta: { format: "pdf" },
    },
    {
      filename: "customer-balance-detail.pdf",
      titleHint: "Customer Balance Detail",
      fallbackPeriod: null,
      uploadDate: new Date().toISOString(),
    },
  );

  const customers = profile!.structuredData.customers as Array<{ name: string }>;
  const uniqueNames = new Set(customers.map((customer) => customer.name.toLowerCase()));
  assert(uniqueNames.size === 8, "page headers must not create duplicate customers");
}

runDetectionTest();
runPdfArExtractionTest();
runMultiPageHeaderTest();
console.log("QUICKBOOKS AR PDF TEST PASS");
