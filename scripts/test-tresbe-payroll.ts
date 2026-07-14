import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  calculateTresbeEntry,
  sumTresbePayroll,
} from "../src/lib/tresbe-payroll/calculations";

const base = {
  totalWeeklyHours: 0,
  regularRate: null,
  serviceRate: null,
  weeklySalary: null,
  manualSystemAmount: 0,
  tips: 0,
  fixedServiceAmount: 0,
  otherAdjustments: 0,
};

assert.deepEqual(
  calculateTresbeEntry({
    ...base,
    payrollRule: "standard_hourly_40_plus_services",
    totalWeeklyHours: 38,
    regularRate: 12,
    serviceRate: 15,
  }),
  {
    systemHours: 38,
    serviceHours: 0,
    systemPay: 456,
    serviceCheckAmount: 0,
    employeeTotal: 456,
  },
  "40 hours or fewer must not create a service check",
);

const over40 = calculateTresbeEntry({
  ...base,
  payrollRule: "standard_hourly_40_plus_services",
  totalWeeklyHours: 45,
  regularRate: 10,
  serviceRate: 20,
  tips: 30,
});
assert.deepEqual(over40, {
  systemHours: 40,
  serviceHours: 5,
  systemPay: 400,
  serviceCheckAmount: 100,
  employeeTotal: 530,
});

const exactly40 = calculateTresbeEntry({
  ...base,
  payrollRule: "standard_hourly_40_plus_services",
  totalWeeklyHours: 40,
  regularRate: 10,
});
assert.equal(exactly40.serviceHours, 0);
assert.equal(exactly40.serviceCheckAmount, 0);

const presetHourly = calculateTresbeEntry({
  ...base,
  payrollRule: "preset_40_hourly",
  totalWeeklyHours: 40,
  regularRate: 16.25,
});
assert.equal(presetHourly.systemHours, 40);
assert.equal(presetHourly.systemPay, 650);
assert.equal(presetHourly.serviceHours, 0);

const presetHourlyOver40 = calculateTresbeEntry({
  ...base,
  payrollRule: "preset_40_hourly",
  totalWeeklyHours: 45,
  regularRate: 16.25,
});
assert.equal(presetHourlyOver40.systemPay, 650);
assert.equal(presetHourlyOver40.serviceHours, 5);
assert.equal(presetHourlyOver40.serviceCheckAmount, 81.25);

const hourlyOverride = calculateTresbeEntry({
  ...base,
  payrollRule: "standard_hourly_40_plus_services",
  totalWeeklyHours: 47.5,
  regularRate: 10,
  serviceRate: 20,
  fixedServiceAmount: 175,
});
assert.equal(hourlyOverride.systemHours, 40);
assert.equal(hourlyOverride.serviceHours, 7.5);
assert.equal(hourlyOverride.serviceCheckAmount, 175);

const fullService = calculateTresbeEntry({
  ...base,
  payrollRule: "full_services",
  totalWeeklyHours: 20,
  serviceRate: 18,
  tips: 25,
});
assert.equal(fullService.systemPay, 0);
assert.equal(fullService.serviceCheckAmount, 360);
assert.equal(fullService.employeeTotal, 385);

const fixedService = calculateTresbeEntry({
  ...base,
  payrollRule: "full_services",
  totalWeeklyHours: 20,
  serviceRate: 18,
  fixedServiceAmount: 500,
});
assert.equal(fixedService.serviceCheckAmount, 500);

const fullServiceRegularRateFallback = calculateTresbeEntry({
  ...base,
  payrollRule: "full_services",
  totalWeeklyHours: 10,
  regularRate: 17.5,
});
assert.equal(fullServiceRegularRateFallback.serviceCheckAmount, 175);

const fixedWeeklyFullService = calculateTresbeEntry({
  ...base,
  payrollRule: "full_services",
  totalWeeklyHours: 0,
  weeklySalary: 220,
  tips: 15,
});
assert.equal(fixedWeeklyFullService.systemPay, 0);
assert.equal(fixedWeeklyFullService.serviceCheckAmount, 220);
assert.equal(fixedWeeklyFullService.employeeTotal, 235);

for (const rule of [
  "preset_40_weekly_salary",
  "fixed_weekly_salary",
] as const) {
  const salary = calculateTresbeEntry({
    ...base,
    payrollRule: rule,
    totalWeeklyHours: 40,
    weeklySalary: 900,
  });
  assert.equal(salary.systemPay, 900, `${rule} must not multiply salary by 40`);
}

const manual = calculateTresbeEntry({
  ...base,
  payrollRule: "custom_manual",
  totalWeeklyHours: 7,
  manualSystemAmount: 200,
  fixedServiceAmount: 50,
  otherAdjustments: -10,
});
assert.equal(manual.employeeTotal, 240);

const unconfigured = calculateTresbeEntry({
  ...base,
  payrollRule: "unconfigured",
  totalWeeklyHours: 10,
});
assert.equal(unconfigured.systemPay, 0);
assert.equal(unconfigured.serviceCheckAmount, 0);

const totals = sumTresbePayroll([
  {
    ...base,
    payrollRule: "standard_hourly_40_plus_services",
    totalWeeklyHours: 45,
    regularRate: 10,
    serviceRate: 20,
    tips: 30,
  },
  {
    ...base,
    payrollRule: "full_services",
    totalWeeklyHours: 20,
    serviceRate: 18,
    tips: 25,
  },
]);
assert.equal(totals.totalSystemPay, 400);
assert.equal(totals.totalServiceChecks, 460);
assert.equal(totals.totalTips, 55);
assert.equal(totals.grandTotal, 915);

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20250713080000_tresbe_weekly_payroll.sql"),
  "utf8",
);
const seed = readFileSync(
  join(root, "supabase/migrations/20250713081000_tresbe_initial_employees.sql"),
  "utf8",
);

assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
assert.match(migration, /Tresbe clients read sent payrolls/);
assert.match(migration, /company_id = public\.current_company_id\(\)/);
assert.match(migration, /Only admins can send Tresbe payroll/);
assert.match(migration, /payroll_rule_snapshot = 'unconfigured'/);
assert.match(
  migration,
  /Sent or cancelled Tresbe payroll entries are immutable/,
);
assert.match(migration, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
assert.match(migration, /'service_override'/);
assert.match(
  migration,
  /WHEN NEW\.service_hours > 0 AND NEW\.fixed_service_amount > 0/,
);
assert.doesNotMatch(
  migration + seed,
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
);
assert.match(seed, /WHERE slug = 'tresbe'/);
assert.match(seed, /ON CONFLICT \(company_id, normalized_name\) DO UPDATE/);

const valueRows = seed.match(/^\s+\('[^\n]+\),?$/gm) ?? [];
assert.equal(valueRows.length, 37, "seed must contain exactly 37 employees");
assert.equal(
  (seed.match(/, true, /g) ?? []).length,
  6,
  "exactly 6 seeded employees receive proportional tips",
);
assert.equal((seed.match(/'BOH',/g) ?? []).length, 22);
assert.equal((seed.match(/'FOH',/g) ?? []).length, 6);
assert.equal((seed.match(/'CAFE CON CE',/g) ?? []).length, 9);
assert.equal((seed.match(/'full_services', 'services'/g) ?? []).length, 4);
assert.equal(
  (seed.match(/'standard_hourly_40_plus_services', 'mixed'/g) ?? []).length,
  0,
);
assert.match(seed, /\('Nashely', NULL/);
assert.match(seed, /\('Yediel', NULL/);

const adminRoute = readFileSync(
  join(
    root,
    "src/app/(dashboard)/dashboard/admin/companies/[companyId]/payroll/page.tsx",
  ),
  "utf8",
);
const pdfRoute = readFileSync(
  join(root, "src/app/api/tresbe-payroll/[payrollId]/pdf/route.ts"),
  "utf8",
);
const clientRoute = readFileSync(
  join(root, "src/app/(dashboard)/dashboard/payroll/page.tsx"),
  "utf8",
);
assert.match(adminRoute, /await requireAdmin\(\)/);
assert.match(adminRoute, /resolveTresbeCompany\(companyId\)/);
assert.match(pdfRoute, /profile\.company_id !== typedPayroll\.company_id/);
assert.match(pdfRoute, /\["sent", "viewed", "corrected"\]/);
assert.match(clientRoute, /resolveTresbeCompany\(profile\.company_id\)/);
assert.match(clientRoute, /resolveSibaritaCompany/);

console.log("TRESBE payroll calculations, seed and authorization guards: PASS");
