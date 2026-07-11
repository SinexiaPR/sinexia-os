import { parseMoney } from "@/lib/intelligence/extractors/base";
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
import type { PayrollExtractionDiagnostics } from "@/lib/intelligence/profiles/types";
import {
  applyPayrollShift,
  buildPayrollProfileResult,
  finalizePayrollEmployees,
  isSkipPayrollEmployeeName,
  normalizePayrollEmployeeKey,
  PAYROLL_FORMULA_ERROR,
  PAYROLL_SKIP_NAME,
  type PayrollEmployeeAccumulator,
} from "@/lib/intelligence/extractors/payroll-shared";

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
  return normalizePayrollEmployeeKey(name);
}

function parseNumericCell(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = cellStr(value);
  if (!raw || PAYROLL_FORMULA_ERROR.test(raw)) return null;
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
  return isSkipPayrollEmployeeName(name);
}

function isSummaryDataRow(row: unknown[], columns: SheetColumns): boolean {
  const firstCell = normalizePayrollHeader(cellStr(row[0]));
  if (/^(total|subtotal|grand total|suma|totales)$/.test(firstCell)) {
    return true;
  }

  const name = cellStr(row[columns.employeeCol]);
  if (PAYROLL_SKIP_NAME.test(name)) return true;

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
    const employees = new Map<string, PayrollEmployeeAccumulator>();
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
        applyPayrollShift(employees, {
          employeeKey: shift.employeeKey,
          displayName: shift.displayName,
          hours: shift.hours,
          overtime: shift.overtime,
          tips: shift.tips,
          grossPay: null,
          netPay: null,
          payroll: shift.payroll,
          fingerprint: shift.fingerprint,
        });
      }

      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];

      for (let i = result.columns.headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i] ?? [];
        const name = cellStr(row[result.columns.employeeCol]);
        if (!name || !PAYROLL_SKIP_NAME.test(name)) continue;
        const payrollValue =
          result.columns.payrollCol != null
            ? parseNumericCell(row[result.columns.payrollCol])
            : null;
        if (payrollValue != null) labeledPayrollTotal = payrollValue;
      }
    }

    const employeeSummaries = finalizePayrollEmployees(employees);
    const employeeCount = employeeSummaries.length;
    const totalHours = employeeSummaries.reduce(
      (sum, employee) => sum + (employee.total_hours ?? 0),
      0,
    );

    const totalTipsSum = employeeSummaries.reduce(
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

    const diagnostics: PayrollExtractionDiagnostics = {
      unique_employee_count: employeeCount,
      total_hours: totalHours > 0 ? Number(totalHours.toFixed(2)) : null,
      total_tips: totalTipsSum > 0 ? Number(totalTipsSum.toFixed(2)) : null,
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

    const result = buildPayrollProfileResult({
      employees: employeeSummaries,
      accumulators: employees,
      period: params.fallbackPeriod,
      titleHint: params.titleHint,
      uploadDate: params.uploadDate,
      sourceFormat: "xlsx",
      sourceSystem: "payroll_excel",
      hasPayrollColumn,
      hasHoursOrTips,
      labeledPayrollTotal,
      extractionDiagnostics: diagnostics,
    });

    logPayroll("payroll_profile_completed", {
      employeeCount,
      totalPayroll: result.structuredData.total_payroll,
      totalHours: result.structuredData.total_hours,
      totalTips: result.structuredData.total_tips,
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
