import assert from "node:assert/strict";

import {
  CALLE_CERRA_AREA,
  computeAreaHoursTips,
  computeAreaPay,
  computeServiceChecksTotal,
  computeTresbeAreaPercentages,
  reconcileTresbeAreaReport,
} from "../src/lib/tresbe-payroll/area-report";
import type {
  TresbeEmployee,
  TresbePayrollDailyEntry,
  TresbePayrollEntry,
} from "../src/services/tresbe-payroll";

// Real numbers from the week of 2026-08-10 (payroll bd142f27-...), given
// directly in the spec, used here as the source of truth for the formulas.

const dailyEntries = [
  { area_snapshot: "BOH", hours: 162.46, tip_cafe_manual: 0, tip_proportional: 0 },
  { area_snapshot: "CAFE CON CE", hours: 99.41, tip_cafe_manual: 733.97, tip_proportional: 0 },
  { area_snapshot: CALLE_CERRA_AREA, hours: 118.08, tip_cafe_manual: 494.48, tip_proportional: 0 },
  { area_snapshot: "FOH", hours: 101.73, tip_cafe_manual: 0, tip_proportional: 883.31 },
  { area_snapshot: "Seguridad", hours: 5.87, tip_cafe_manual: 0, tip_proportional: 0 },
].map((row, index) => ({
  id: `daily-${index}`,
  payroll_id: "p1",
  company_id: "c1",
  employee_id: `emp-${index}`,
  work_date: "2026-08-10",
  shift: "AM",
  receives_proportional_tips_snapshot: false,
  is_correction: false,
  correction_reason: null,
  notes: null,
  ...row,
})) as unknown as TresbePayrollDailyEntry[];

const areaHoursTips = computeAreaHoursTips(dailyEntries);
assert.deepEqual(
  areaHoursTips.find((a) => a.area === "BOH"),
  { area: "BOH", hours: 162.46, tips: 0 },
);
assert.deepEqual(
  areaHoursTips.find((a) => a.area === "CAFE CON CE"),
  { area: "CAFE CON CE", hours: 99.41, tips: 733.97 },
);
assert.deepEqual(
  areaHoursTips.find((a) => a.area === CALLE_CERRA_AREA),
  { area: CALLE_CERRA_AREA, hours: 118.08, tips: 494.48 },
);
assert.deepEqual(
  areaHoursTips.find((a) => a.area === "FOH"),
  { area: "FOH", hours: 101.73, tips: 883.31 },
);
// Tips Tresbe (BOH + FOH) = 0 + 883.31
const tipsTresbe = round2(
  (areaHoursTips.find((a) => a.area === "BOH")?.tips ?? 0) +
    (areaHoursTips.find((a) => a.area === "FOH")?.tips ?? 0),
);
assert.equal(tipsTresbe, 883.31);
const totalTipsFromAreas = round2(
  areaHoursTips.reduce((sum, a) => sum + a.tips, 0),
);
assert.equal(totalTipsFromAreas, 2111.76);

// Weekly pay, grouped by the employee's current tresbe_employees.area.
const employees: Pick<TresbeEmployee, "id" | "area">[] = [
  { id: "e-boh", area: "BOH" },
  { id: "e-cafeconce", area: "CAFE CON CE" },
  { id: "e-callecerra", area: CALLE_CERRA_AREA },
  { id: "e-foh", area: "FOH" },
  { id: "e-seguridad", area: "Seguridad" },
];
const makeEntry = (overrides: Partial<TresbePayrollEntry>): TresbePayrollEntry => ({
  id: overrides.id ?? "entry",
  payroll_id: "p1",
  employee_id: overrides.employee_id!,
  employee_name_snapshot: "Empleado",
  area_snapshot: "BOH",
  payment_method_snapshot: "mixed",
  payroll_rule_snapshot: "standard_hourly_40_plus_services",
  receives_proportional_tips_snapshot: false,
  regular_rate_snapshot: null,
  service_rate_snapshot: null,
  weekly_salary_snapshot: null,
  is_new_employee: false,
  total_weekly_hours: 0,
  system_hours: 0,
  service_hours: 0,
  manual_system_amount: 0,
  system_pay: 0,
  tips: 0,
  fixed_service_amount: 0,
  service_check_amount: 0,
  other_adjustments: 0,
  employee_total: 0,
  vacation_paid_hours: 0,
  sick_paid_hours: 0,
  holiday_paid_hours: 0,
  jury_duty_hours: 0,
  bereavement_hours: 0,
  service_reason: null,
  comment: null,
  ...overrides,
});
const payrollEntries = [
  makeEntry({ id: "1", employee_id: "e-boh", system_pay: 5659.05, employee_total: 5659.05 }),
  makeEntry({ id: "2", employee_id: "e-cafeconce", system_pay: 838.2, employee_total: 1462.93 }),
  makeEntry({ id: "3", employee_id: "e-callecerra", system_pay: 1592.29, employee_total: 2196.01 }),
  makeEntry({ id: "4", employee_id: "e-foh", system_pay: 743.82, employee_total: 1627.13 }),
  makeEntry({ id: "5", employee_id: "e-seguridad", system_pay: 325.0, employee_total: 325.0 }),
];
const areaPay = computeAreaPay(payrollEntries, employees);
assert.deepEqual(
  areaPay.find((a) => a.area === "BOH"),
  { area: "BOH", paidNoTip: 5659.05, total: 5659.05 },
);
assert.deepEqual(
  areaPay.find((a) => a.area === "CAFE CON CE"),
  { area: "CAFE CON CE", paidNoTip: 838.2, total: 1462.93 },
);
assert.deepEqual(
  areaPay.find((a) => a.area === CALLE_CERRA_AREA),
  { area: CALLE_CERRA_AREA, paidNoTip: 1592.29, total: 2196.01 },
);
assert.deepEqual(
  areaPay.find((a) => a.area === "FOH"),
  { area: "FOH", paidNoTip: 743.82, total: 1627.13 },
);

// Reconciliation: sums must match the payroll header exactly. Use the real
// sum of areaPay's paidNoTip as the "expected" side to prove a matching
// payroll reconciles clean...
const sumPaidNoTip = round2(areaPay.reduce((s, a) => s + a.paidNoTip, 0));
const matching = reconcileTresbeAreaReport(
  { total_system_pay: sumPaidNoTip, total_service_checks: 0, total_tips: 2111.76 },
  areaPay,
  areaHoursTips,
);
assert.equal(matching.ok, true);
assert.equal(matching.warnings.length, 0);

// ...and a genuinely mismatched header must be flagged, not silently passed.
const mismatched = reconcileTresbeAreaReport(
  { total_system_pay: sumPaidNoTip - 30, total_service_checks: 0, total_tips: 2111.76 },
  areaPay,
  areaHoursTips,
);
assert.equal(mismatched.ok, false);
assert.equal(mismatched.warnings.length, 1);

// % de nómina, last PDF page.
const percentages = computeTresbeAreaPercentages(
  { sales_tresbe: 10673.98, sales_cafe_con_ce_calle_cerra: 4403.14 },
  areaPay,
);
assert.equal(percentages.nonCalleCerraPaidNoTip, 7566.07);
assert.equal(percentages.calleCerraPaidNoTip, 1592.29);
assert.equal(percentages.allAreasPaidNoTip, 9158.36);
// Note: spec text says 70.89%; the precise value of $7,566.07 / $10,673.98
// is 70.8833...%, which rounds to 70.88% -- a 0.01-point rounding
// difference from the spec, not a reconciliation failure (the underlying
// dollar sum matches exactly). Flagged for Maria in the summary.
assert.equal(percentages.nominaTresbePct, 70.88);
assert.equal(
  percentages.incidencia.find((i) => i.area === "BOH")?.pct,
  53.02,
);
assert.equal(
  percentages.incidencia.find((i) => i.area === "FOH")?.pct,
  6.97,
);
assert.equal(
  percentages.incidencia.find((i) => i.area === "CAFE CON CE")?.pct,
  7.85,
);
assert.equal(
  percentages.incidencia.find((i) => i.area === CALLE_CERRA_AREA)?.pct,
  36.16,
);
assert.equal(percentages.calleCerraNominaPct, 36.16);
assert.equal(percentages.worstCasePct, 85.8);

// Total pagado por cheques de servicios: service_check_amount alone (not
// "+ fixed_service_amount" as literally written in the spec -- see the
// comment on computeServiceChecksTotal for why that would double-count).
const withServiceCheck = [
  makeEntry({
    id: "svc",
    employee_id: "e-boh",
    service_check_amount: 280,
    fixed_service_amount: 280,
    employee_total: 930,
  }),
];
assert.equal(computeServiceChecksTotal(withServiceCheck), 280);

console.log("TRESBE area report: PASS");

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
