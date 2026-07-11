import {
  buildSummary,
  confidenceFromFields,
  parseMoney,
} from "@/lib/intelligence/extractors/base";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";

type SheetColumns = {
  headerIdx: number;
  employeeCol: number;
  hoursCol: number | null;
  overtimeCol: number | null;
  tipsCol: number | null;
  payrollCol: number | null;
  headers: string[];
};

type EmployeeAccumulator = {
  name: string;
  shifts_count: number;
  total_hours: number;
  overtime_hours: number;
  total_tips: number;
  payroll_sum: number;
};

const SKIP_NAME =
  /^(total|subtotal|grand\s*total|suma|totales?|headers?|empleado|employee|nombre|name|staff|worker|trabajador|associate)$/i;
const FORMULA_ERROR = /^#(NAME\?|REF!|VALUE!|DIV\/0!|N\/A|NULL!|NUM!)/i;

function logPayroll(event: string, meta: Record<string, unknown>) {
  console.info(`[sinexia-payroll] ${event}`, meta);
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeEmployeeKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseNumericCell(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = cellStr(value);
  if (!raw || FORMULA_ERROR.test(raw)) return null;
  return parseMoney(raw);
}

function scoreEmployeeHeader(cell: string): number {
  const h = normalizeHeader(cell);
  if (h === "empleado") return 100;
  if (h === "employee") return 95;
  if (h === "employee name") return 95;
  if (h === "nombre") return 90;
  if (/^(staff|worker|trabajador|associate)$/.test(h)) return 80;
  if (/empleado|employee|nombre/.test(h)) return 40;
  return 0;
}

function scoreHoursHeader(cell: string): number {
  const h = normalizeHeader(cell);
  if (h === "horas" || h === "hours") return 100;
  if (h === "total horas turno") return 95;
  if (/horas|hours/.test(h) && !/extra|overtime|ot/.test(h)) return 60;
  return 0;
}

function scoreOvertimeHeader(cell: string): number {
  const h = normalizeHeader(cell);
  if (/horas?\s*extra|overtime|\bot\b/.test(h)) return 100;
  return 0;
}

function scoreTipsHeader(cell: string): number {
  const h = normalizeHeader(cell);
  if (h === "tips total" || h === "propinas total") return 100;
  if (h === "tip proporcional calc" || h === "tip proporcional") return 95;
  if (/tips?|propinas?/.test(h) && !/manual/.test(h)) return 70;
  return 0;
}

function scorePayrollHeader(cell: string): number {
  const h = normalizeHeader(cell);
  if (/tips?|propinas?|horas?|hours|turno|fecha|area|notas/.test(h)) return 0;
  if (/^(gross\s*pay|net\s*pay|net|salary|salario|nomina|wage|total\s*pay|payroll|pago|earning|amount)$/.test(h)) {
    return 100;
  }
  if (/gross|net\s*pay|salary|salario|nomina|payroll|pago/.test(h)) return 80;
  return 0;
}

function bestColumnIndex(
  row: string[],
  scorer: (cell: string) => number,
): number | null {
  let bestIdx: number | null = null;
  let bestScore = 0;

  for (let i = 0; i < row.length; i++) {
    const score = scorer(row[i] ?? "");
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestScore > 0 ? bestIdx : null;
}

function detectSheetColumns(matrix: unknown[][]): SheetColumns | null {
  for (let i = 0; i < Math.min(matrix.length, 50); i++) {
    const row = (matrix[i] ?? []).map(cellStr);
    const employeeCol = bestColumnIndex(row, scoreEmployeeHeader);
    if (employeeCol == null) continue;

    const headers = row.map((cell) => cell.trim()).filter(Boolean);
    return {
      headerIdx: i,
      employeeCol,
      hoursCol: bestColumnIndex(row, scoreHoursHeader),
      overtimeCol: bestColumnIndex(row, scoreOvertimeHeader),
      tipsCol: bestColumnIndex(row, scoreTipsHeader),
      payrollCol: bestColumnIndex(row, scorePayrollHeader),
      headers,
    };
  }

  return null;
}

function rowLooksLikeRepeatedHeader(row: unknown[], columns: SheetColumns): boolean {
  const cells = row.map(cellStr);
  const name = cells[columns.employeeCol] ?? "";
  if (scoreEmployeeHeader(name) >= 90) return true;

  let headerMatches = 0;
  for (const cell of cells) {
    if (
      scoreEmployeeHeader(cell) >= 90 ||
      scoreHoursHeader(cell) >= 90 ||
      scoreTipsHeader(cell) >= 90 ||
      scorePayrollHeader(cell) >= 90
    ) {
      headerMatches += 1;
    }
  }

  return headerMatches >= 2;
}

function isSkipEmployeeName(name: string): boolean {
  if (!name) return true;
  if (FORMULA_ERROR.test(name)) return true;
  if (SKIP_NAME.test(name)) return true;
  return false;
}

function mergeEmployee(
  map: Map<string, EmployeeAccumulator>,
  name: string,
  row: {
    hours: number | null;
    overtime: number | null;
    tips: number | null;
    payroll: number | null;
  },
) {
  const key = normalizeEmployeeKey(name);
  const displayName = name.trim().replace(/\s+/g, " ");
  const existing = map.get(key);

  if (existing) {
    existing.shifts_count += 1;
    if (row.hours != null) existing.total_hours += row.hours;
    if (row.overtime != null) existing.overtime_hours += row.overtime;
    if (row.tips != null) existing.total_tips += row.tips;
    if (row.payroll != null && row.payroll > 0) existing.payroll_sum += row.payroll;
    return;
  }

  map.set(key, {
    name: displayName,
    shifts_count: 1,
    total_hours: row.hours ?? 0,
    overtime_hours: row.overtime ?? 0,
    total_tips: row.tips ?? 0,
    payroll_sum: row.payroll != null && row.payroll > 0 ? row.payroll : 0,
  });
}

function processSheet(
  matrix: unknown[][],
  sheetName: string,
  employees: Map<string, EmployeeAccumulator>,
): { dataRows: number; newEmployees: number; columns: SheetColumns | null } {
  const columns = detectSheetColumns(matrix);
  if (!columns) {
    return { dataRows: 0, newEmployees: 0, columns: null };
  }

  logPayroll("payroll_headers_detected", {
    sheetName,
    headerIdx: columns.headerIdx,
    headers: columns.headers,
  });

  logPayroll("payroll_employee_column", {
    sheetName,
    employeeCol: columns.employeeCol,
    header: columns.headers[columns.employeeCol] ?? null,
    hoursCol: columns.hoursCol,
    overtimeCol: columns.overtimeCol,
    tipsCol: columns.tipsCol,
    payrollCol: columns.payrollCol,
  });

  const beforeSize = employees.size;
  let dataRows = 0;

  for (let i = columns.headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (!row.some((cell) => cellStr(cell))) continue;
    if (rowLooksLikeRepeatedHeader(row, columns)) continue;

    const name = cellStr(row[columns.employeeCol]);
    if (isSkipEmployeeName(name)) continue;

    dataRows += 1;

    mergeEmployee(employees, name, {
      hours:
        columns.hoursCol != null
          ? parseNumericCell(row[columns.hoursCol])
          : null,
      overtime:
        columns.overtimeCol != null
          ? parseNumericCell(row[columns.overtimeCol])
          : null,
      tips:
        columns.tipsCol != null
          ? parseNumericCell(row[columns.tipsCol])
          : null,
      payroll:
        columns.payrollCol != null
          ? parseNumericCell(row[columns.payrollCol])
          : null,
    });
  }

  const newEmployees = employees.size - beforeSize;

  logPayroll("payroll_data_rows", {
    sheetName,
    dataRows,
    newEmployees,
    duplicateRowsInSheet: Math.max(0, dataRows - newEmployees),
  });

  return { dataRows, newEmployees, columns };
}

export function extractPayrollFromExcelBuffer(
  buffer: Buffer,
  params: {
    titleHint: string;
    fallbackPeriod: string | null;
    uploadDate: string;
  },
): ExtractionProfileResult | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: true,
    });

    const employees = new Map<string, EmployeeAccumulator>();
    let totalDataRows = 0;
    let totalDuplicateRows = 0;
    let hasPayrollColumn = false;
    let hasHoursOrTips = false;
    let labeledPayrollTotal: number | null = null;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];

      if (!matrix.length) continue;

      const { dataRows, newEmployees, columns } = processSheet(
        matrix,
        sheetName,
        employees,
      );

      if (!columns) continue;

      totalDataRows += dataRows;
      totalDuplicateRows += Math.max(0, dataRows - newEmployees);

      if (columns.payrollCol != null) hasPayrollColumn = true;
      if (columns.hoursCol != null || columns.tipsCol != null) {
        hasHoursOrTips = true;
      }

      for (let i = columns.headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i] ?? [];
        const name = cellStr(row[columns.employeeCol]);
        if (!name || !SKIP_NAME.test(name)) continue;
        const payrollValue =
          columns.payrollCol != null
            ? parseNumericCell(row[columns.payrollCol])
            : null;
        if (payrollValue != null) labeledPayrollTotal = payrollValue;
      }
    }

    const employeeSummaries = Array.from(employees.values()).map((employee) => ({
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
    }));

    const employeeCount = employeeSummaries.length;

    logPayroll("payroll_unique_employee_count", {
      employeeCount,
      totalDataRows,
    });

    logPayroll("payroll_duplicate_employee_rows", {
      duplicateRows: totalDuplicateRows,
    });

    if (employeeCount === 0 && !hasHoursOrTips && !hasPayrollColumn) {
      return null;
    }

    let totalPayroll: number | null = null;
    if (hasPayrollColumn) {
      const payrollSum = employeeSummaries.reduce((sum, employee) => {
        const acc = employees.get(normalizeEmployeeKey(employee.name));
        return sum + (acc?.payroll_sum ?? 0);
      }, 0);
      totalPayroll =
        labeledPayrollTotal != null
          ? labeledPayrollTotal
          : payrollSum > 0
            ? Number(payrollSum.toFixed(2))
            : null;
    }

    const totalHours = employeeSummaries.reduce(
      (sum, employee) => sum + (employee.total_hours ?? 0),
      0,
    );
    const totalOvertime = employeeSummaries.reduce(
      (sum, employee) => sum + (employee.overtime_hours ?? 0),
      0,
    );
    const totalTips = employeeSummaries.reduce(
      (sum, employee) => sum + (employee.total_tips ?? 0),
      0,
    );

    const structuredData: Record<string, unknown> = {
      company: null,
      period: params.fallbackPeriod,
      employee_count: employeeCount || null,
      total_payroll: totalPayroll,
      total_hours: totalHours > 0 ? Number(totalHours.toFixed(2)) : null,
      overtime_hours:
        totalOvertime > 0 ? Number(totalOvertime.toFixed(2)) : null,
      total_tips: totalTips > 0 ? Number(totalTips.toFixed(2)) : null,
      employees: employeeSummaries.sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      ),
      source_document: params.titleHint,
      upload_date: params.uploadDate,
      source_system: "payroll_excel",
    };

    const summaryParts: Array<string | null> = [
      employeeCount ? `${employeeCount} empleados` : null,
      totalHours > 0 ? `${Number(totalHours.toFixed(2))} horas totales` : null,
      totalTips > 0
        ? `Propinas: $${totalTips.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null,
      totalPayroll != null
        ? `Nómina total: $${totalPayroll.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : hasHoursOrTips
          ? "Sin monto de nómina en el archivo (solo horas/propinas)"
          : null,
    ];

    const result: ExtractionProfileResult = {
      documentType: "payroll",
      period: params.fallbackPeriod,
      structuredData,
      summary: buildSummary(summaryParts),
      confidence: confidenceFromFields([
        employeeCount,
        totalPayroll,
        totalHours > 0 ? totalHours : null,
        totalTips > 0 ? totalTips : null,
      ]),
    };

    logPayroll("payroll_profile_completed", {
      employeeCount,
      totalPayroll,
      totalHours: structuredData.total_hours,
      totalTips: structuredData.total_tips,
      employeeSample: employeeSummaries.slice(0, 5).map((employee) => employee.name),
    });

    return result;
  } catch (error) {
    logPayroll("payroll_profile_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
