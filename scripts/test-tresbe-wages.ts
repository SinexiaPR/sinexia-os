import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20250713082000_tresbe_official_wages_20260713.sql",
);
const sql = readFileSync(migrationPath, "utf8");
const confirmedSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20250713083000_tresbe_confirmed_aliases_wages.sql",
  ),
  "utf8",
);
const reconciliationSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20250714091000_tresbe_employee_reconciliation.sql",
  ),
  "utf8",
);

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

assert.match(
  confirmedSql,
  /\('jared rivera', 'Jared Rivera Rodriguez', 10\.50\)/,
);
assert.match(
  confirmedSql,
  /\('lee pierre', 'Lee Zephyrus P\. Irene', 13\.00\)/,
);
assert.match(
  confirmedSql,
  /\('lee sanchez', 'Lee J\. de Jesus Sanchez', 11\.00\)/,
);
assert.match(confirmedSql, /\('henry casiano', 'Casiano Henry', 15\.00\)/);
assert.match(
  confirmedSql,
  /normalized_name = 'fernando almonte'[\s\S]+default_weekly_salary = 400\.00|default_weekly_salary = 400\.00[\s\S]+normalized_name = 'fernando almonte'/,
);
assert.match(
  confirmedSql,
  /normalized_name = 'ramon luis rivera'[\s\S]+default_weekly_salary = 220\.00|default_weekly_salary = 220\.00[\s\S]+normalized_name = 'ramon luis rivera'/,
);
assert.match(
  confirmedSql,
  /normalized_name = 'ramon luis rivera'[\s\S]+payroll_rule = 'full_services'|payroll_rule = 'full_services'[\s\S]+normalized_name = 'ramon luis rivera'/,
);
assert.match(confirmedSql, /'yediel', 'carlos ramos'/);
assert.match(
  confirmedSql,
  /WHEN COALESCE\(NEW\.weekly_salary_snapshot, 0\) > 0/,
);
assert.match(confirmedSql, /COALESCE\(e\.weekly_salary_snapshot, 0\) <= 0/);
assert.match(confirmedSql, /'julian mateo'::TEXT, 10\.00::NUMERIC/);
assert.match(confirmedSql, /'nashely'::TEXT, 4\.50::NUMERIC/);
assert.match(confirmedSql, /employee\.payroll_rule = 'full_services'/);
assert.doesNotMatch(
  confirmedSql,
  /INSERT INTO public\.tresbe_employees/,
  "confirmed aliases must never create duplicate employees",
);
assert.match(
  confirmedSql,
  /UPDATE public\.tresbe_payroll_entries/,
  "open payroll entries must receive confirmed full-service rules",
);
assert.match(
  confirmedSql,
  /payroll\.status IN \('draft', 'calculated', 'corrected'\)/,
);
assert.doesNotMatch(
  confirmedSql,
  /payroll\.status IN \([^)]*'sent'/,
  "confirmed wages must not rewrite historical payroll snapshots",
);
assert.doesNotMatch(
  confirmedSql,
  /normalized_name\s*=\s*'seguridad'/,
  "Ramon Luis Rivera replaces the generic Seguridad record",
);

for (const alias of [
  "jared rivera",
  "rivera rodriguez, jared",
  "lee sanchez",
  "de jesus sanchez, lee j.",
  "lee zephyrus p. irene",
  "irene, lee zephyrinus p.",
  "regino",
  "pizarro, regino",
]) {
  assert.match(reconciliationSql, new RegExp(alias.replaceAll(".", "\\.")));
}
assert.match(
  reconciliationSql,
  /CREATE TABLE IF NOT EXISTS public\.tresbe_employee_aliases/,
);
assert.match(reconciliationSql, /UNIQUE\(company_id, normalized_alias\)/);
assert.match(reconciliationSql, /employee\.payroll_rule = 'preset_40_hourly'/);
assert.match(reconciliationSql, /regular_hourly_rate = 16\.25/);
assert.match(reconciliationSql, /default_weekly_hours = 40/);
assert.match(reconciliationSql, /default_weekly_salary = NULL/);
assert.match(
  reconciliationSql,
  /payroll\.status IN \('draft', 'calculated', 'corrected'\)/,
);
assert.doesNotMatch(
  reconciliationSql,
  /payroll\.status IN \([^)]*'sent'/,
  "reconciliation must never rewrite sent payroll snapshots",
);
assert.match(reconciliationSql, /employee\.is_active/);
assert.match(reconciliationSql, /wage_requires_review/);
assert.doesNotMatch(
  reconciliationSql,
  /INSERT INTO public\.tresbe_employees/,
  "reconciliation must not create employees",
);
assert.match(reconciliationSql, /Only admins can reconcile Tresbe employees/);
assert.match(reconciliationSql, /public\.is_tresbe_company\(p_company_id\)/);

console.log("TRESBE official wage migration and review safeguards: PASS");
