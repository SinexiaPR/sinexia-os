import assert from "node:assert/strict";

import {
  getCompanyCategory,
  normalizeCompanyCategory,
} from "../src/lib/companies/categories";

const cases = new Map<string, string>([
  ["Payroll / Timesheets", "payroll"],
  ["Nómina", "payroll"],
  ["Invoice", "invoices"],
  ["Factura de suplidor", "invoices"],
  ["Receipt", "receipts"],
  ["Bank Statement", "bank-statements"],
  ["Payment Receipt", "payment-receipts"],
  ["Customer Balance Detail", "accounts-receivable"],
  ["Vendor Balance Detail", "accounts-payable"],
  ["Aging", "accounts-receivable"],
  ["Tax Document", "tax-documents"],
  ["Contract", "contracts"],
  ["Identification", "identification"],
  ["Unknown custom file", "other"],
]);

for (const [input, expected] of cases)
  assert.equal(normalizeCompanyCategory(input), expected, input);
assert.equal(getCompanyCategory("payroll")?.label, "Nómina");
assert.equal(getCompanyCategory("not-valid"), null);

console.log("Company workspace category normalization tests passed.");
