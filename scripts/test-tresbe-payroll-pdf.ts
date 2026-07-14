import assert from "node:assert/strict";

import { PDFDocument } from "pdf-lib";

import {
  buildTresbePayrollPdf,
  hasTresbePayrollValue,
} from "../src/lib/tresbe-payroll/pdf";
import type {
  TresbePayroll,
  TresbePayrollEntry,
} from "../src/services/tresbe-payroll";

const payroll = {
  id: "payroll-test",
  company_id: "company-test",
  week_start: "2026-07-06",
  week_end: "2026-07-12",
  status: "sent",
  employee_count: 2,
  total_weekly_hours: 65,
  total_system_hours: 40,
  total_service_hours: 25,
  total_system_pay: 400,
  total_tips: 55,
  total_service_checks: 460,
  total_adjustments: 0,
  grand_total: 915,
  admin_note: null,
  client_note: "Nómina preparada para revisión.",
  supporting_document_id: null,
  pdf_storage_path: "/api/tresbe-payroll/payroll-test/pdf",
  sent_at: "2026-07-13T12:00:00Z",
  viewed_at: null,
  email_recipient: null,
  email_status: null,
  email_sent_at: null,
  email_error: null,
  created_at: "2026-07-13T11:00:00Z",
} satisfies TresbePayroll;

const makeEntry = (
  overrides: Partial<TresbePayrollEntry>,
): TresbePayrollEntry => ({
  id: "entry-1",
  payroll_id: payroll.id,
  employee_id: "employee-1",
  employee_name_snapshot: "Lee Pierre",
  area_snapshot: "BOH",
  payment_method_snapshot: "mixed",
  payroll_rule_snapshot: "standard_hourly_40_plus_services",
  receives_proportional_tips_snapshot: false,
  regular_rate_snapshot: 10,
  service_rate_snapshot: 20,
  weekly_salary_snapshot: null,
  is_new_employee: false,
  total_weekly_hours: 45,
  system_hours: 40,
  service_hours: 5,
  manual_system_amount: 0,
  system_pay: 400,
  tips: 30,
  fixed_service_amount: 0,
  service_check_amount: 100,
  other_adjustments: 0,
  employee_total: 530,
  service_reason: "Horas sobre 40",
  comment: null,
  ...overrides,
});

async function main() {
  const emptyEntry = makeEntry({
    total_weekly_hours: 0,
    system_hours: 0,
    service_hours: 0,
    system_pay: 0,
    tips: 0,
    service_check_amount: 0,
    other_adjustments: 0,
    employee_total: 0,
  });
  assert.equal(hasTresbePayrollValue(emptyEntry), false);
  assert.equal(
    hasTresbePayrollValue({ ...emptyEntry, total_weekly_hours: 40 }),
    false,
    "hours without an amount to pay must stay out of the PDF",
  );
  assert.equal(hasTresbePayrollValue(makeEntry({})), true);
  assert.equal(hasTresbePayrollValue({ ...emptyEntry, tips: 25 }), true);

  const bytes = await buildTresbePayrollPdf({
    companyName: "Tresbe",
    payroll,
    entries: [
      makeEntry({}),
      makeEntry({
        id: "entry-2",
        employee_id: "employee-2",
        employee_name_snapshot: "Nashely",
        area_snapshot: "FOH",
        payment_method_snapshot: "services",
        payroll_rule_snapshot: "full_services",
        receives_proportional_tips_snapshot: true,
        regular_rate_snapshot: null,
        service_rate_snapshot: 18,
        total_weekly_hours: 20,
        system_hours: 0,
        service_hours: 20,
        system_pay: 0,
        tips: 25,
        service_check_amount: 360,
        employee_total: 385,
        service_reason: "Empleado por servicios",
      }),
      emptyEntry,
    ],
  });

  assert.ok(bytes.length > 1_000, "PDF must contain rendered payroll content");
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1, "payroll summary must fit one page");
  assert.equal(parsed.getTitle(), "Nomina Tresbe 2026-07-06");
  assert.equal(parsed.getAuthor(), "Sinexia OS");

  console.log("TRESBE payroll PDF generation: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
