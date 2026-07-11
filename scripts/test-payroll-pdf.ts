import { extractPayrollFromPdfText } from "@/lib/intelligence/extractors/payroll-pdf";
import { isLikelyPayrollDocument } from "@/lib/intelligence/extractors/payroll-detect";
import { INTELLIGENCE_LIMITS } from "@/lib/intelligence/constants";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const SAMPLE_PDF_TEXT = `
Payroll Detail Report
Period: 2026-07-01 to 2026-07-07

Employee          Date        Regular Hours   OT Hours   Tips Total   Gross Pay
GARCIA, MARIA     07/01/2026  8.00            0.00       15.00        240.00
GARCIA, MARIA     07/02/2026  6.00            1.00       12.00        210.00
CUADRADO, ADALBERTO J. 07/01/2026 8.00       0.00       22.50        320.00
TOTAL                                              33.00      49.50        770.00

Employee          Date        Regular Hours   OT Hours   Tips Total   Gross Pay
RODRIGUEZ, PEDRO  07/03/2026  7.50            0.00       10.00        225.00
`;

function runPdfPayrollTest() {
  const profile = extractPayrollFromPdfText(SAMPLE_PDF_TEXT, {
    titleHint: "Payroll Detail",
    fallbackPeriod: "2026-07",
    uploadDate: new Date().toISOString(),
  });

  assert(profile != null, "pdf payroll profile should not be null");
  assert(profile!.structuredData.employee_count === 3, "expected 3 employees");
  assert(profile!.structuredData.total_hours === 29.5, "expected 29.5 total hours");
  assert(profile!.structuredData.source_format === "pdf", "source format pdf");
  assert(
    profile!.structuredData.total_payroll != null,
    "expected payroll total from gross pay",
  );
}

function runPayrollDetectionTest() {
  assert(
    isLikelyPayrollDocument({
      reportCategory: "Payroll",
      titleHint: "Weekly hours",
      text: SAMPLE_PDF_TEXT,
    }),
    "payroll category should detect payroll",
  );
  assert(
    !isLikelyPayrollDocument({
      titleHint: "Bank statement",
      text: "Account balance closing 1234.56",
    }),
    "bank statement should not detect as payroll",
  );
}

function runEmptyPdfTextTest() {
  assert(
    extractPayrollFromPdfText("", {
      titleHint: "Payroll",
      fallbackPeriod: null,
      uploadDate: new Date().toISOString(),
    }) == null,
    "empty pdf text should not produce profile",
  );
  assert(
    extractPayrollFromPdfText("x".repeat(INTELLIGENCE_LIMITS.minUsableTextChars - 1), {
      titleHint: "Payroll",
      fallbackPeriod: null,
      uploadDate: new Date().toISOString(),
    }) == null,
    "short non-tabular text should not produce profile",
  );
}

runPayrollDetectionTest();
runEmptyPdfTextTest();
runPdfPayrollTest();
console.log("PDF PAYROLL TEST PASS");
