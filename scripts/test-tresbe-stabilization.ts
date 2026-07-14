import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  calculateTresbeEntry,
  sumTresbePayroll,
} from "../src/lib/tresbe-payroll/calculations";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260714130000_stabilize_tresbe_payroll.sql"),
  "utf8",
);
const reconciliation = readFileSync(
  join(
    root,
    "supabase/migrations/20250714091000_tresbe_employee_reconciliation.sql",
  ),
  "utf8",
);
const actions = readFileSync(
  join(root, "src/actions/tresbe-payroll.ts"),
  "utf8",
);
const workspace = readFileSync(
  join(root, "src/components/tresbe-payroll/admin-workspace.tsx"),
  "utf8",
);

const fernando40 = calculateTresbeEntry({
  payrollRule: "preset_40_hourly",
  totalWeeklyHours: 40,
  regularRate: 16.25,
  serviceRate: null,
  weeklySalary: null,
  manualSystemAmount: 0,
  tips: 0,
  fixedServiceAmount: 0,
  otherAdjustments: 0,
});
assert.deepEqual(fernando40, {
  systemHours: 40,
  serviceHours: 0,
  systemPay: 650,
  serviceCheckAmount: 0,
  employeeTotal: 650,
});

const fernando45 = calculateTresbeEntry({
  payrollRule: "preset_40_hourly",
  totalWeeklyHours: 45,
  regularRate: 16.25,
  serviceRate: null,
  weeklySalary: null,
  manualSystemAmount: 0,
  tips: 0,
  fixedServiceAmount: 0,
  otherAdjustments: 0,
});
assert.equal(fernando45.systemHours, 40);
assert.equal(fernando45.serviceHours, 5);
assert.equal(fernando45.systemPay, 650);
assert.equal(fernando45.serviceCheckAmount, 81.25);
assert.equal(fernando45.employeeTotal, 731.25, "over-40 pay counted once");

const under40 = calculateTresbeEntry({
  payrollRule: "standard_hourly_40_plus_services",
  totalWeeklyHours: 39,
  regularRate: 10,
  serviceRate: null,
  weeklySalary: null,
  manualSystemAmount: 0,
  tips: 0,
  fixedServiceAmount: 0,
  otherAdjustments: 0,
});
assert.equal(under40.serviceCheckAmount, 0);

const ramon = calculateTresbeEntry({
  payrollRule: "full_services",
  totalWeeklyHours: 0,
  regularRate: null,
  serviceRate: null,
  weeklySalary: 220,
  manualSystemAmount: 0,
  tips: 0,
  fixedServiceAmount: 0,
  otherAdjustments: 0,
});
assert.equal(ramon.systemPay, 0);
assert.equal(ramon.serviceCheckAmount, 220);

const totals = sumTresbePayroll([
  {
    payrollRule: "preset_40_hourly",
    totalWeeklyHours: 40,
    regularRate: 16.25,
    serviceRate: null,
    weeklySalary: null,
    manualSystemAmount: 0,
    tips: 10,
    fixedServiceAmount: 0,
    otherAdjustments: 0,
  },
  {
    payrollRule: "full_services",
    totalWeeklyHours: 0,
    regularRate: null,
    serviceRate: null,
    weeklySalary: 220,
    manualSystemAmount: 0,
    tips: 0,
    fixedServiceAmount: 0,
    otherAdjustments: -5,
  },
]);
assert.equal(totals.grandTotal, 875);
assert.equal(
  totals.grandTotal,
  totals.totalSystemPay +
    totals.totalTips +
    totals.totalServiceChecks +
    totals.totalAdjustments,
);

for (const alias of [
  "rivera rodriguez, jared",
  "de jesus sanchez, lee j.",
  "irene, lee zephyrinus p.",
  "pizarro, regino",
]) {
  assert.match(reconciliation, new RegExp(alias.replaceAll(".", "\\."), "i"));
}
assert.match(
  reconciliation,
  /FOREACH alias_value IN ARRAY mapping\.aliases LOOP/,
);
assert.doesNotMatch(reconciliation, /\bFOR\s+\w+\s+IN ARRAY\b/);
assert.match(
  reconciliation,
  /payroll\.status IN \('draft', 'calculated', 'corrected'\)/,
);
assert.match(migration, /normalized_name = 'fernando almonte'/);
assert.match(migration, /regular_hourly_rate = 16\.25/);
assert.match(migration, /default_weekly_salary = NULL/);
assert.match(migration, /normalized_name = 'sofia'/);
assert.match(migration, /employee\.is_active/);
assert.match(migration, /ON CONFLICT \(payroll_id, employee_id\) DO NOTHING/);
assert.match(migration, /Requiere tarifa/);
assert.match(migration, /Requiere regla de pago/);
assert.doesNotMatch(migration, /Not present in official report/);
assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION public\.delete_tresbe_payroll_draft/,
);
assert.match(migration, /v_payroll\.sent_at IS NOT NULL/);
assert.match(migration, /tresbe_payroll_deletion_events/);
assert.match(migration, /tresbe_employee_configuration_events/);
assert.match(
  migration,
  /payroll\.status IN \('draft', 'calculated', 'corrected'\)/,
);
assert.match(
  migration,
  /entry\.total_weekly_hours > 0 OR entry\.manual_system_amount > 0/,
);

assert.match(actions, /replace_tresbe_employee_aliases/);
assert.match(actions, /\.select\("\*"\)\s*\.single\(\)/);
assert.match(actions, /saveTresbePayrollDraft\.entry/);
assert.match(actions, /deleteTresbePayrollDraft/);
assert.match(workspace, /sticky top-0/);
assert.match(workspace, /Eliminar nómina/);
assert.match(workspace, /Calculado:/);

console.log("TRESBE stabilization persistence, rules and UI guards: PASS");
