import assert from "node:assert/strict";

import {
  computeTresbeMarginAnalysis,
  isNonPayrollServiceEntry,
} from "../src/lib/tresbe-payroll/margin-analysis";
import type {
  TresbePayroll,
  TresbePayrollEntry,
} from "../src/services/tresbe-payroll";

const payroll = {
  id: "p1",
  company_id: "c1",
  week_start: "2026-08-10",
  week_end: "2026-08-16",
  status: "calculated",
  employee_count: 2,
  total_weekly_hours: 80,
  total_system_hours: 80,
  total_service_hours: 0,
  total_system_pay: 1300,
  total_tips: 1613.88,
  total_service_checks: 280,
  total_adjustments: 0,
  grand_total: 3193.88,
  sales_tresbe: 7000,
  sales_cafe_con_ce: 3673.98,
  sales_cafe_con_ce_calle_cerra: 4403.14,
  calle_cerra_nomina_sin_propina: 1271.84,
  calle_cerra_tips: 494.48,
  admin_note: null,
  client_note: null,
  supporting_document_id: null,
  pdf_storage_path: null,
  sent_at: null,
  viewed_at: null,
  email_recipient: null,
  email_status: null,
  email_sent_at: null,
  email_error: null,
  created_at: "2026-08-19T00:00:00Z",
} satisfies TresbePayroll;

const makeEntry = (
  overrides: Partial<TresbePayrollEntry>,
): TresbePayrollEntry => ({
  id: "e1",
  payroll_id: payroll.id,
  employee_id: "employee-1",
  employee_name_snapshot: "Empleado",
  area_snapshot: "BOH",
  payment_method_snapshot: "mixed",
  payroll_rule_snapshot: "preset_40_hourly",
  receives_proportional_tips_snapshot: false,
  regular_rate_snapshot: 16.25,
  service_rate_snapshot: null,
  weekly_salary_snapshot: null,
  is_new_employee: false,
  total_weekly_hours: 40,
  system_hours: 40,
  service_hours: 0,
  manual_system_amount: 0,
  system_pay: 650,
  tips: 0,
  fixed_service_amount: 0,
  service_check_amount: 0,
  other_adjustments: 0,
  employee_total: 650,
  vacation_paid_hours: 0,
  sick_paid_hours: 0,
  holiday_paid_hours: 0,
  jury_duty_hours: 0,
  bereavement_hours: 0,
  service_reason: null,
  comment: null,
  ...overrides,
});

// A flat services check with zero overtime hours is flagged as non-payroll.
const reimbursement = makeEntry({
  id: "e-reimbursement",
  fixed_service_amount: 280,
  service_check_amount: 280,
  service_reason: "Empleado por servicios",
  comment: "Reembolso de $280.00 por compras",
  employee_total: 930,
});
assert.equal(isNonPayrollServiceEntry(reimbursement), true);

// Real overtime-based service pay must never be flagged.
const overtimeService = makeEntry({
  id: "e-overtime",
  total_weekly_hours: 45,
  service_hours: 5,
  service_check_amount: 100,
  service_reason: "Horas sobre 40",
});
assert.equal(isNonPayrollServiceEntry(overtimeService), false);

// A full_services employee's ordinary check is never flagged either.
const fullServices = makeEntry({
  id: "e-full-services",
  payroll_rule_snapshot: "full_services",
  total_weekly_hours: 20,
  service_hours: 20,
  service_check_amount: 360,
  service_reason: "Empleado por servicios",
});
assert.equal(isNonPayrollServiceEntry(fullServices), false);

const analysis = computeTresbeMarginAnalysis(payroll, [
  reimbursement,
  overtimeService,
]);

assert.equal(analysis.venta.tresbeCafeConCe, 10673.98);
assert.equal(analysis.venta.calleCerra, 4403.14);
assert.equal(analysis.venta.total, 15077.12);

assert.equal(analysis.tresbe.deducciones.length, 1);
assert.equal(analysis.tresbe.deducciones[0].importe, -280);
assert.equal(
  analysis.tresbe.deducciones[0].concepto,
  "Reembolso de $280.00 por compras",
);
// grand_total(3193.88) - 280 (reimbursement) - 1613.88 (tips) = 1300
assert.equal(analysis.tresbe.nominaSinPropina, 1300);

assert.equal(analysis.calleCerra.nominaSinPropina, 1271.84);
assert.equal(analysis.calleCerra.hasData, true);

// 1300 (Tresbe) + 1271.84 (Calle Cerra) = 2571.84
assert.equal(analysis.combinado.nominaSinPropina, 2571.84);
assert.equal(
  analysis.combinado.porcentajeSobreVentaTotal,
  Math.round((2571.84 / 15077.12) * 100 * 100) / 100,
);

assert.equal(
  analysis.porcentajeSobreVentaTotalPorNegocio.tresbe,
  Math.round((1300 / 15077.12) * 100 * 100) / 100,
);
assert.equal(
  analysis.porcentajeSobreVentaTotalPorNegocio.calleCerra,
  Math.round((1271.84 / 15077.12) * 100 * 100) / 100,
);
assert.equal(
  analysis.porcentajePropio.tresbe,
  Math.round((1300 / 10673.98) * 100 * 100) / 100,
);
assert.equal(
  analysis.porcentajePropio.calleCerra,
  Math.round((1271.84 / 4403.14) * 100 * 100) / 100,
);

// No Calle Cerra data entered yet -- must not fabricate a 0% row.
const noCalleCerra = computeTresbeMarginAnalysis(
  { ...payroll, calle_cerra_nomina_sin_propina: null, calle_cerra_tips: null },
  [],
);
assert.equal(noCalleCerra.calleCerra.hasData, false);
assert.equal(noCalleCerra.calleCerra.nominaSinPropina, 0);

// No sales entered for a business -- percentage must be null, not a
// division-by-zero artifact.
const noSales = computeTresbeMarginAnalysis(
  { ...payroll, sales_tresbe: 0, sales_cafe_con_ce: 0 },
  [],
);
assert.equal(noSales.porcentajePropio.tresbe, null);

console.log("TRESBE margin analysis: PASS");
