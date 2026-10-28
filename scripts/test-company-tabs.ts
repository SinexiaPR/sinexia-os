import assert from "node:assert/strict";

import { getActiveCompanyTab, getCompanyTabs } from "../src/lib/companies/tabs";

const ids = (slug: string) =>
  getCompanyTabs({ id: "x", slug }).map((t) => t.id);

assert.deepEqual(ids("tresbe"), [
  "resumen",
  "facturas",
  "nomina",
  "presupuesto",
  "documentos",
  "reportes",
  "actividad",
]);
assert.deepEqual(ids("sibarita"), [
  "resumen",
  "facturas",
  "nomina",
  "documentos",
  "reportes",
  "actividad",
]);
assert.deepEqual(ids("cut-meat-distributors"), [
  "resumen",
  "facturas",
  "informes",
  "documentos",
  "reportes",
  "actividad",
]);
assert.deepEqual(ids("magol"), [
  "resumen",
  "facturas",
  "documentos",
  "reportes",
  "actividad",
]);
assert.ok(!ids("magol").includes("nomina"), "sin módulo activo no hay pestaña");

const sibarita = getCompanyTabs({ id: "abc", slug: "sibarita" });
assert.equal(
  sibarita.find((t) => t.id === "nomina")?.href,
  "/dashboard/payroll?company=abc",
);

const co = { id: "abc", slug: "cut-meat-distributors" };
const base = "/dashboard/admin/companies/abc";
assert.equal(getActiveCompanyTab(co, base, null), "resumen");
assert.equal(getActiveCompanyTab(co, base, "actividad"), "actividad");
assert.equal(getActiveCompanyTab(co, `${base}/invoices`, null), "facturas");
assert.equal(
  getActiveCompanyTab(co, `${base}/daily-reports`, null),
  "informes",
);
assert.equal(getActiveCompanyTab(co, `${base}/recurrentes`, null), "informes");
assert.equal(getActiveCompanyTab(co, `${base}/receipts`, null), "resumen");
assert.equal(getActiveCompanyTab(co, `${base}/documentos`, null), "documentos");
assert.equal(getActiveCompanyTab(co, "/dashboard/payroll", null), "nomina");

console.log("Company tabs: PASS");
