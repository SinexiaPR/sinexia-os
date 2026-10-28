import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

// La pestaña Nómina de Sibarita sigue apuntando a su nómina semanal aunque no
// haya un documento de nómina cargado (ahora vive en la lógica de pestañas).
const companyTabs = readFileSync("src/lib/companies/tabs.ts", "utf8");
assert.match(companyTabs, /slug === "sibarita"/);
assert.match(
  companyTabs,
  /href: `\/dashboard\/payroll\?company=\$\{id\}`/,
  "Sibarita payroll remains accessible without an uploaded payroll document",
);

console.log("Company workspace category normalization tests passed.");
