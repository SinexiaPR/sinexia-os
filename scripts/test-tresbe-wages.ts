import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20250713082000_tresbe_official_wages_20260713.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const officialRows = sql.match(/^\s+\('[^\n]+\)[,;]$/gm) ?? [];
assert.equal(officialRows.length, 28, "exactly 28 official employees required");
assert.equal(
  (sql.match(/'hourly', [0-9]+\.[0-9]{2}, NULL, NULL\)/g) ?? []).length,
  26,
  "exactly 26 official hourly wages required",
);
assert.equal(
  (sql.match(/'salaried', NULL, [0-9]+\.[0-9]{2}, [0-9]+\.[0-9]{2}\)/g) ?? [])
    .length,
  2,
  "exactly 2 official salaried employees required",
);

assert.match(
  sql,
  /'alberto l\. chaves',[^\n]+32500\.00, 625\.00/,
  "Alberto weekly salary must be 625.00",
);
assert.match(
  sql,
  /'mario ormaza mercado',[^\n]+40000\.00, 769\.23/,
  "Mario weekly salary must be 769.23",
);
assert.match(
  sql,
  /WHEN report\.official_key = 'leslie a\. ruiz santiago'[\s\S]+THEN 'full_services'/,
  "Leslie must remain full service",
);
assert.match(sql, /ELSE 'standard_hourly_40_plus_services'/);
assert.match(sql, /ELSE employee\.service_hourly_rate/);
assert.match(sql, /payroll\.status IN \('draft', 'calculated', 'corrected'\)/);
assert.doesNotMatch(
  sql,
  /payroll\.status IN \([^)]*'sent'/,
  "closed payroll snapshots must not be updated",
);
assert.match(sql, /tresbe_employee_wage_events/);
assert.match(sql, /audit_tresbe_employee_wage_change/);
assert.match(sql, /Tresbe Employee List Report — 2026-07-13/);
assert.match(sql, /tresbe_wage_review_items/);
assert.match(sql, /Ambiguous employee match/);
assert.match(sql, /Not present in official July 13, 2026 employee report/);
assert.match(sql, /employee\.normalized_name = report\.official_key/);
assert.match(sql, /employee\.source_name/);
assert.match(sql, /official_match_count = 1/);
assert.match(sql, /employee_report_count = 1/);
assert.match(sql, /public\.is_tresbe_company\(employee\.company_id\)/);
assert.doesNotMatch(
  sql,
  /INSERT INTO public\.tresbe_employees/,
  "official wage import must not create employees without an area",
);
assert.doesNotMatch(
  sql,
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  "company UUIDs must not be hardcoded",
);

const expectedUnmatchedOfficial = [
  "lee j. de jesus sanchez",
  "lee zephyrus p. irene",
  "jared rivera rodriguez",
];
for (const name of expectedUnmatchedOfficial)
  assert.match(sql, new RegExp(name));

console.log("TRESBE official wage migration and review safeguards: PASS");
