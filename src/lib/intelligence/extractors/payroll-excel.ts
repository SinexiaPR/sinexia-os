import {
  buildSummary,
  confidenceFromFields,
  parseMoney,
} from "@/lib/intelligence/extractors/base";
import {
  buildShiftFingerprint,
  classifySheetTier,
  detectHoursColumns,
  normalizePayrollHeader,
  normalizeWorkedHoursValue,
  resolveRowWorkedHours,
  type SheetTier,
} from "@/lib/intelligence/extractors/payroll-hours";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";

type SheetColumns = {
  headerIdx: number;
  employeeCol: number;
  dateCol: number | null;
  areaCol: number | null;
  hoursCols: ReturnType<typeof detectHoursColumns>;
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

type ParsedShift = {
  employeeKey: string;
  displayName: string;
  hours: number | null;
  overtime: number | null;
  tips: number | null;
  payroll: number | null;
  fingerprint: string;
};

type SheetProcessResult = {
  tier: SheetTier;
  columns: SheetColumns | null;
  includedRows: number;
  excludedRows: number;
  duplicateRowsSkipped: number;
  rawHoursTotal: number;
  normalizedHoursTotal: number;
  shifts: ParsedShift[];
};

type PayrollDiagnostics = {
  unique_employee_count: number;
  total_hours: number | null;
  total_tips: number | null;
  rows_included: number;
  rows_skipped: number;
  rows_deduplicated: number;
  unique_shift_rows: number;
  sheets_processed: string[];
  sheets_skipped: string[];
  sheet_summaries: Array<{
    sheetName: string;
    employeeColumn: string | null;
    detectedHourColumns: string[];
    includedRows: number;
    excludedRows: number;
    rawHoursTotal: number;
    normalizedHoursTotal: number;
  }>;
};

const SKIP_NAME =
  /^(total|subtotal|grand\s*total|suma|totales?|headers?|empleado|employee|nombre|name|staff|worker|trabajador|associate)$/i;
const FORMULA_ERROR = /^#(NAME\?|REF!|VALUE!|DIV\/0!|N\/A|NULL!|NUM!)/i;

function logPayroll(event: string, meta: Record<string, unknown>) {
  console.info(`[sinexia-payroll] ${event}`, meta);
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
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
  const h = normalizePayrollHeader(cell);
  if (h === "empleado") return 100;
  if (h === "employee") return 95;
  if (h === "employee name") return 95;
  if (h === "nombre") return 90;
  if (/^(staff|worker|trabajador|associate)$/.test(h)) return 80;
  if (/empleado|employee|nombre/.test(h)) return 40;
  return 0;
}

function scoreDateHeader(cell: string): number {
  const h = normalizePayrollHeader(cell);
  if (/^(fecha|date|work date|dia)$/.test(h)) return 100;
  return 0;
}

function scoreAreaHeader(cell: string): number {
  const h = normalizePayrollHeader(cell);
  if (/^(area dia|area|department|depto|location|ubicacion)$/.test(h)) {
    return 100;
  }
  if (/area|departamento|ubicacion/.test(h)) return 70;
  return 0;
}

function scoreOvertimeHeader(cell: string): number {
  const h = normalizePayrollHeader(cell);
  if (/horas?\s*extra|overtime|\bot\b/.test(h)) return 100;
  return 0;
}

function scoreTipsHeader(cell: string): number {
  const h = normalizePayrollHeader(cell);
  if (h === "tips total" || h === "propinas total") return 100;
  if (h === "tip proporcional calc" || h === "tip proporcional") return 95;
  if (/tips?|propinas?/.test(h) && !/manual/.test(h)) return 70;
  return 0;
}

function scorePayrollHeader(cell: string): number {
  const h = normalizePayrollHeader(cell);
  if (/tips?|propinas?|horas?|hours|turno|fecha|area|notas/.test(h)) return 0;
  if (
    /^(gross\s*pay|net\s*pay|net|salary|salario|nomina|wage|total\s*pay|payroll|pago|earning|amount)$/.test(
      h,
    )
  ) {
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

    const headers = row.map((cell) => cell.trim());
    return {
      headerIdx: i,
      employeeCol,
      dateCol: bestColumnIndex(row, scoreDateHeader),
      areaCol: bestColumnIndex(row, scoreAreaHeader),
      hoursCols: detectHoursColumns(headers),
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
    const normalized = normalizePayrollHeader(cell);
    if (
      scoreEmployeeHeader(cell) >= 90 ||
      normalized === "horas" ||
      normalized === "hours" ||
      normalized === "fecha" ||
      normalized === "date"
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

function isSummaryDataRow(row: unknown[], columns: SheetColumns): boolean {
  const firstCell = normalizePayrollHeader(cellStr(row[0]));
  if (/^(total|subtotal|grand total|suma|totales)$/.test(firstCell)) {
    return true;
  }

  const name = cellStr(row[columns.employeeCol]);
  if (SKIP_NAME.test(name)) return true;

  return false;
}

function getCellFormat(
  sheet: Record<string, unknown>,
  rowIdx: number,
  colIdx: number,
  XLSX: { utils: { encode_cell: (addr: { r: number; c: number }) => string } },
): string | undefined {
  const address = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
  const cell = sheet[address] as { z?: string } | undefined;
  return cell?.z;
}

function parseSheetShifts(params: {
  matrix: unknown[][];
  sheet: Record<string, unknown>;
  sheetName: string;
  XLSX: { utils: { encode_cell: (addr: { r: number; c: number }) => string } };
}): SheetProcessResult {
  const { matrix, sheet, sheetName, XLSX } = params;
  const columns = detectSheetColumns(matrix);

  if (!columns) {
    return {
      tier: "skip",
      columns: null,
      includedRows: 0,
      excludedRows: 0,
      duplicateRowsSkipped: 0,
      rawHoursTotal: 0,
      normalizedHoursTotal: 0,
      shifts: [],
    };
  }

  const tier = classifySheetTier(
    sheetName,
    true,
    columns.dateCol != null || columns.hoursCols.clockInCol != null,
  );

  logPayroll("payroll_headers_detected", {
    sheetName,
    headerIdx: columns.headerIdx,
    headers: columns.headers.filter(Boolean),
  });

  logPayroll("payroll_employee_column", {
    sheetName,
    employeeCol: columns.employeeCol,
    header: columns.headers[columns.employeeCol] ?? null,
    hoursCol: columns.hoursCols.workedHoursCol,
    detectedHourColumns: columns.hoursCols.detectedHourColumns,
    clockInCol: columns.hoursCols.clockInCol,
    clockOutCol: columns.hoursCols.clockOutCol,
  });

  const shifts: ParsedShift[] = [];
  let includedRows = 0;
  let excludedRows = 0;
  let rawHoursTotal = 0;
  let normalizedHoursTotal = 0;

  for (let i = columns.headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (!row.some((cell) => cellStr(cell))) {
      excludedRows += 1;
      continue;
    }
    if (rowLooksLikeRepeatedHeader(row, columns)) {
      excludedRows += 1;
      continue;
    }
    if (isSummaryDataRow(row, columns)) {
      excludedRows += 1;
      continue;
    }

    const name = cellStr(row[columns.employeeCol]);
    if (isSkipEmployeeName(name)) {
      excludedRows += 1;
      continue;
    }

    const dateValue =
      columns.dateCol != null ? cellStr(row[columns.dateCol]) : null;
    if (columns.dateCol != null && !dateValue) {
      excludedRows += 1;
      continue;
    }

    const rawHoursValue =
      columns.hoursCols.workedHoursCol != null
        ? row[columns.hoursCols.workedHoursCol]
        : null;
    if (typeof rawHoursValue === "number" && Number.isFinite(rawHoursValue)) {
      rawHoursTotal += rawHoursValue;
    }

    const hours = resolveRowWorkedHours({
      row,
      workedHoursCol: columns.hoursCols.workedHoursCol,
      clockInCol: columns.hoursCols.clockInCol,
      clockOutCol: columns.hoursCols.clockOutCol,
      breakCol: columns.hoursCols.breakCol,
      rowIdx: i,
      getCellFormat: (rowIdx, colIdx) =>
        getCellFormat(sheet, rowIdx, colIdx, XLSX),
    });

    if (hours != null) {
      normalizedHoursTotal += hours;
    }

    const clockIn =
      columns.hoursCols.clockInCol != null
        ? cellStr(row[columns.hoursCols.clockInCol])
        : null;
    const clockOut =
      columns.hoursCols.clockOutCol != null
        ? cellStr(row[columns.hoursCols.clockOutCol])
        : null;
    const area =
      columns.areaCol != null ? cellStr(row[columns.areaCol]) : null;

    includedRows += 1;
    shifts.push({
      employeeKey: normalizeEmployeeKey(name),
      displayName: name.trim().replace(/\s+/g, " "),
      hours,
      overtime:
        columns.overtimeCol != null
          ? normalizeWorkedHoursValue(row[columns.overtimeCol], {
              isWorkedHoursColumn: true,
            })
          : null,
      tips:
        columns.tipsCol != null
          ? parseNumericCell(row[columns.tipsCol])
          : null,
      payroll:
        columns.payrollCol != null
          ? parseNumericCell(row[columns.payrollCol])
          : null,
      fingerprint: buildShiftFingerprint({
        employeeKey: normalizeEmployeeKey(name),
        date: dateValue,
        clockIn,
        clockOut,
        hours,
        area,
      }),
    });
  }

  logPayroll("payroll_sheet_hours_summary", {
    sheetName,
    employeeColumn: columns.headers[columns.employeeCol] ?? null,
    detectedHourColumns: columns.hoursCols.detectedHourColumns,
    includedRows,
    excludedRows,
    rawHoursTotal: Number(rawHoursTotal.toFixed(2)),
    normalizedHoursTotal: Number(normalizedHoursTotal.toFixed(2)),
  });

  return {
    tier,
    columns,
    includedRows,
    excludedRows,
    duplicateRowsSkipped: 0,
    rawHoursTotal,
    normalizedHoursTotal,
    shifts,
  };
}

function applyShiftToEmployee(
  employees: Map<string, EmployeeAccumulator>,
  shift: ParsedShift,
) {
  const existing = employees.get(shift.employeeKey);

  if (existing) {
    existing.shifts_count += 1;
    if (shift.hours != null) existing.total_hours += shift.hours;
    if (shift.overtime != null) existing.overtime_hours += shift.overtime;
    if (shift.tips != null) existing.total_tips += shift.tips;
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
    payroll_sum: shift.payroll != null && shift.payroll > 0 ? shift.payroll : 0,
  });
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

    const sheetResults: Array<{ sheetName: string; result: SheetProcessResult }> =
      [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName] as
        | Record<string, unknown>
        | undefined;
      if (!sheet) continue;

      const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];

      if (!matrix.length) continue;

      sheetResults.push({
        sheetName,
        result: parseSheetShifts({ matrix, sheet, sheetName, XLSX }),
      });
    }

    const detailSheets = sheetResults.filter(
      (entry) => entry.result.tier === "detail" && entry.result.shifts.length > 0,
    );
    const sheetsToUse =
      detailSheets.length > 0
        ? detailSheets
        : sheetResults.filter(
            (entry) =>
              entry.result.tier !== "skip" && entry.result.shifts.length > 0,
          );

    const seenFingerprints = new Set<string>();
    const employees = new Map<string, EmployeeAccumulator>();
    let rowsIncluded = 0;
    let rowsSkipped = 0;
    let rowsDeduplicated = 0;
    let hasPayrollColumn = false;
    let hasHoursOrTips = false;
    let labeledPayrollTotal: number | null = null;

    for (const { sheetName, result } of sheetsToUse) {
      if (!result.columns) continue;

      if (result.columns.payrollCol != null) hasPayrollColumn = true;
      if (
        result.columns.hoursCols.workedHoursCol != null ||
        result.columns.hoursCols.clockInCol != null ||
        result.columns.tipsCol != null
      ) {
        hasHoursOrTips = true;
      }

      rowsSkipped += result.excludedRows;

      for (const shift of result.shifts) {
        if (seenFingerprints.has(shift.fingerprint)) {
          rowsDeduplicated += 1;
          continue;
        }

        seenFingerprints.add(shift.fingerprint);
        rowsIncluded += 1;
        applyShiftToEmployee(employees, shift);
      }

      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];

      for (let i = result.columns.headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i] ?? [];
        const name = cellStr(row[result.columns.employeeCol]);
        if (!name || !SKIP_NAME.test(name)) continue;
        const payrollValue =
          result.columns.payrollCol != null
            ? parseNumericCell(row[result.columns.payrollCol])
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

    logPayroll("payroll_unique_employee_count", {
      employeeCount,
      rowsIncluded,
    });

    logPayroll("payroll_duplicate_employee_rows", {
      duplicateRows: rowsDeduplicated,
    });

    logPayroll("payroll_total_hours_summary", {
      sheetsProcessed: sheetsToUse.map((entry) => entry.sheetName),
      uniqueShiftRows: seenFingerprints.size,
      duplicateRowsSkipped: rowsDeduplicated,
      totalHours: totalHours > 0 ? Number(totalHours.toFixed(2)) : null,
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

    const diagnostics: PayrollDiagnostics = {
      unique_employee_count: employeeCount,
      total_hours: totalHours > 0 ? Number(totalHours.toFixed(2)) : null,
      total_tips: totalTips > 0 ? Number(totalTips.toFixed(2)) : null,
      rows_included: rowsIncluded,
      rows_skipped: rowsSkipped,
      rows_deduplicated: rowsDeduplicated,
      unique_shift_rows: seenFingerprints.size,
      sheets_processed: sheetsToUse.map((entry) => entry.sheetName),
      sheets_skipped: sheetResults
        .filter(
          (entry) =>
            !sheetsToUse.some((used) => used.sheetName === entry.sheetName),
        )
        .map((entry) => entry.sheetName),
      sheet_summaries: sheetResults
        .filter((entry) => entry.result.columns)
        .map(({ sheetName, result }) => ({
          sheetName,
          employeeColumn:
            result.columns?.headers[result.columns.employeeCol] ?? null,
          detectedHourColumns: result.columns?.hoursCols.detectedHourColumns ?? [],
          includedRows: result.includedRows,
          excludedRows: result.excludedRows,
          rawHoursTotal: Number(result.rawHoursTotal.toFixed(2)),
          normalizedHoursTotal: Number(result.normalizedHoursTotal.toFixed(2)),
        })),
    };

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
      extraction_diagnostics: diagnostics,
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

// Re-export hour helpers for tests.
export {
  computeClockPairHours,
  normalizeWorkedHoursValue,
  parseClockTimeToHours,
} from "@/lib/intelligence/extractors/payroll-hours";
