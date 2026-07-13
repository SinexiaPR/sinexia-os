import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculatePayrollEntry } from "../src/lib/payroll/calculations";
import type { WeeklyPayrollEntry } from "../src/services/payroll";

const migration = readFileSync(
  resolve("supabase/migrations/20250713010000_sibarita_weekly_payroll.sql"),
  "utf8",
);
const seededRows = [
  ...migration.matchAll(/\(v_company,'([^']+)','([^']+)'/g),
].map((match) => `${match[1]} ${match[2]}`.toLowerCase());
assert.equal(seededRows.length, 18, "expected 18 initial employees");
assert.equal(
  new Set(seededRows).size,
  18,
  "seed contains no duplicate normalized employees",
);
for (const name of [
  "valerie vicente",
  "daniel gonzalez",
  "hector ortiz",
  "fernando almonte",
])
  assert.equal(
    seededRows.filter((employee) => employee === name).length,
    1,
    name,
  );
assert.match(migration, /ON CONFLICT\(company_id,normalized_name\) DO NOTHING/);
assert.match(migration, /Rikardo','Gonzalez'.*true/);
assert.match(migration, /Juan C','Berrios Santini'.*true/);
assert.match(migration, /Fernando','Almonte'.*true/);
assert.match(migration, /Submitted payroll entries are immutable/);
assert.match(migration, /Weekly payroll is only enabled for Sibarita/);

const entry: WeeklyPayrollEntry = {
  id: "e",
  payroll_id: "p",
  employee_id: "x",
  employee_name_snapshot: "Test",
  section_snapshot: "BOH",
  compensation_type_snapshot: "hourly_training",
  regular_rate_snapshot: 10,
  training_rate_snapshot: 15,
  fixed_salary_snapshot: null,
  requires_review_snapshot: false,
  regular_hours: 40,
  training_hours: 2,
  other_payments: 25,
  comment: null,
};
assert.equal(calculatePayrollEntry(entry), 455);
assert.equal(
  calculatePayrollEntry({
    ...entry,
    compensation_type_snapshot: "fixed_weekly",
    fixed_salary_snapshot: 800,
    regular_hours: 0,
    training_hours: 0,
  }),
  825,
);

console.log(
  "Sibarita seed, duplicate cleanup, snapshots, isolation, and payroll calculation tests passed.",
);
