import {
  buildSummary,
  confidenceFromFields,
} from "@/lib/intelligence/extractors/base";
import type {
  PayrollEmployeeSummary,
  PayrollExtractionDiagnostics,
} from "@/lib/intelligence/profiles/types";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";

export type PayrollSourceFormat = "xlsx" | "pdf" | "text";

export type PayrollShiftInput = {
  employeeKey: string;
  displayName: string;
  hours: number | null;
  overtime: number | null;
  tips: number | null;
  grossPay: number | null;
  netPay: number | null;
  payroll: number | null;
  fingerprint: string;
};

export type PayrollEmployeeAccumulator = {
  name: string;
  shifts_count: number;
  total_hours: number;
  overtime_hours: number;
  total_tips: number;
  gross_pay: number;
  net_pay: number;
  payroll_sum: number;
};

export const PAYROLL_SKIP_NAME =
  /^(total|subtotal|grand\s*total|suma|totales?|headers?|empleado|employee|nombre|name|staff|worker|trabajador|associate)$/i;

export const PAYROLL_FORMULA_ERROR =
  /^#(NAME\?|REF!|VALUE!|DIV\/0!|N\/A|NULL!|NUM!)/i;

export function normalizePayrollEmployeeKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isSkipPayrollEmployeeName(name: string): boolean {
  if (!name) return true;
  if (PAYROLL_FORMULA_ERROR.test(name)) return true;
  if (PAYROLL_SKIP_NAME.test(name)) return true;
  return false;
}

export function applyPayrollShift(
  employees: Map<string, PayrollEmployeeAccumulator>,
  shift: PayrollShiftInput,
) {
  const existing = employees.get(shift.employeeKey);

  if (existing) {
    existing.shifts_count += 1;
    if (shift.hours != null) existing.total_hours += shift.hours;
    if (shift.overtime != null) existing.overtime_hours += shift.overtime;
    if (shift.tips != null) existing.total_tips += shift.tips;
    if (shift.grossPay != null && shift.grossPay > 0) {
      existing.gross_pay += shift.grossPay;
    }
    if (shift.netPay != null && shift.netPay > 0) {
      existing.net_pay += shift.netPay;
    }
    if (shift.payroll != null && shift.payroll > 0) {
      existing.payroll_sum += shift.payroll;
    }
    return;
  }

  employees.set(shift.employeeKey, {
    name: shift.displayName,
    shifts_count: 1,
    total_hours: shift.hours ?? 0,
    overtime_hours: shift.overtime ?? 0,
    total_tips: shift.tips ?? 0,
    gross_pay: shift.grossPay != null && shift.grossPay > 0 ? shift.grossPay : 0,
    net_pay: shift.netPay != null && shift.netPay > 0 ? shift.netPay : 0,
    payroll_sum: shift.payroll != null && shift.payroll > 0 ? shift.payroll : 0,
  });
}

export function finalizePayrollEmployees(
  employees: Map<string, PayrollEmployeeAccumulator>,
): PayrollEmployeeSummary[] {
  return Array.from(employees.values())
    .map((employee) => ({
      name: employee.name,
      shifts_count: employee.shifts_count,
      total_hours:
        employee.total_hours > 0
          ? Number(employee.total_hours.toFixed(2))
          : null,
      overtime_hours:
        employee.overtime_hours > 0
          ? Number(employee.overtime_hours.toFixed(2))
          : null,
      total_tips:
        employee.total_tips > 0
          ? Number(employee.total_tips.toFixed(2))
          : null,
      gross_pay:
        employee.gross_pay > 0 ? Number(employee.gross_pay.toFixed(2)) : null,
      net_pay: employee.net_pay > 0 ? Number(employee.net_pay.toFixed(2)) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function buildPayrollProfileResult(params: {
  employees: PayrollEmployeeSummary[];
  accumulators: Map<string, PayrollEmployeeAccumulator>;
  period: string | null;
  titleHint: string;
  uploadDate: string;
  sourceFormat: PayrollSourceFormat;
  sourceSystem: string;
  hasPayrollColumn: boolean;
  hasHoursOrTips: boolean;
  labeledPayrollTotal: number | null;
  extractionDiagnostics?: PayrollExtractionDiagnostics;
}): ExtractionProfileResult {
  const employeeCount = params.employees.length;

  const totalHours = params.employees.reduce(
    (sum, employee) => sum + (employee.total_hours ?? 0),
    0,
  );
  const totalOvertime = params.employees.reduce(
    (sum, employee) => sum + (employee.overtime_hours ?? 0),
    0,
  );
  const totalTips = params.employees.reduce(
    (sum, employee) => sum + (employee.total_tips ?? 0),
    0,
  );

  let totalPayroll: number | null = null;
  if (params.hasPayrollColumn) {
    const payrollSum = params.employees.reduce((sum, employee) => {
      const acc = params.accumulators.get(normalizePayrollEmployeeKey(employee.name));
      return sum + (acc?.payroll_sum ?? 0);
    }, 0);
    const grossSum = params.employees.reduce((sum, employee) => {
      const acc = params.accumulators.get(normalizePayrollEmployeeKey(employee.name));
      return sum + (acc?.gross_pay ?? 0);
    }, 0);
    const netSum = params.employees.reduce((sum, employee) => {
      const acc = params.accumulators.get(normalizePayrollEmployeeKey(employee.name));
      return sum + (acc?.net_pay ?? 0);
    }, 0);

    const computed =
      payrollSum > 0 ? payrollSum : grossSum > 0 ? grossSum : netSum > 0 ? netSum : 0;

    totalPayroll =
      params.labeledPayrollTotal != null
        ? params.labeledPayrollTotal
        : computed > 0
          ? Number(computed.toFixed(2))
          : null;
  }

  const structuredData: Record<string, unknown> = {
    company: null,
    period: params.period,
    employee_count: employeeCount || null,
    total_payroll: totalPayroll,
    total_hours: totalHours > 0 ? Number(totalHours.toFixed(2)) : null,
    overtime_hours:
      totalOvertime > 0 ? Number(totalOvertime.toFixed(2)) : null,
    total_tips: totalTips > 0 ? Number(totalTips.toFixed(2)) : null,
    employees: params.employees,
    source_format: params.sourceFormat,
    source_document: params.titleHint,
    upload_date: params.uploadDate,
    source_system: params.sourceSystem,
  };

  if (params.extractionDiagnostics) {
    structuredData.extraction_diagnostics = params.extractionDiagnostics;
  }

  const summaryParts: Array<string | null> = [
    employeeCount ? `${employeeCount} empleados` : null,
    totalHours > 0 ? `${Number(totalHours.toFixed(2))} horas totales` : null,
    totalOvertime > 0
      ? `${Number(totalOvertime.toFixed(2))} horas extra`
      : null,
    totalTips > 0
      ? `Propinas: $${totalTips.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null,
    totalPayroll != null
      ? `Nómina total: $${totalPayroll.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : params.hasHoursOrTips
        ? "Sin monto de nómina en el archivo (solo horas/propinas)"
        : null,
  ];

  return {
    documentType: "payroll",
    period: params.period,
    structuredData,
    summary: buildSummary(summaryParts),
    confidence: confidenceFromFields([
      employeeCount,
      totalPayroll,
      totalHours > 0 ? totalHours : null,
      totalTips > 0 ? totalTips : null,
      totalOvertime > 0 ? totalOvertime : null,
    ]),
  };
}
