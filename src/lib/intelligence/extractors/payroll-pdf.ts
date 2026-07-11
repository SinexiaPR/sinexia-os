import { parseMoney } from "@/lib/intelligence/extractors/base";
import {
  buildShiftFingerprint,
  detectHoursColumns,
  normalizePayrollHeader,
  normalizeWorkedHoursValue,
  resolveRowWorkedHours,
} from "@/lib/intelligence/extractors/payroll-hours";
import {
  applyPayrollShift,
  buildPayrollProfileResult,
  finalizePayrollEmployees,
  isSkipPayrollEmployeeName,
  normalizePayrollEmployeeKey,
  PAYROLL_FORMULA_ERROR,
  type PayrollEmployeeAccumulator,
} from "@/lib/intelligence/extractors/payroll-shared";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";

const SKIP_LINE =
  /^(total|subtotal|grand\s*total|suma|totales?|page\s*\d+|report|payroll|n[oó]mina)/i;

function logPayrollPdf(event: string, meta: Record<string, unknown>) {
  console.info(`[sinexia-payroll-pdf] ${event}`, meta);
}

function splitPayrollRow(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((cell) => cell.trim());
  }

  const dateMatch = line.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (dateMatch && dateMatch.index != null) {
    const name = line.slice(0, dateMatch.index).trim();
    const rest = line.slice(dateMatch.index).trim();
    return [name, ...rest.split(/\s+/).filter(Boolean)];
  }

  const spaced = line
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (spaced.length >= 3) {
    return spaced;
  }

  return line.split(/\s+/).filter(Boolean);
}

function scoreEmployeeCell(cell: string): number {
  const normalized = cell.toLowerCase();
  if (/^(empleado|employee|employee name|nombre|name|staff)$/.test(normalized)) {
    return 100;
  }
  if (/empleado|employee|nombre/.test(normalized)) return 50;
  return 0;
}

function scoreDateCell(cell: string): number {
  const normalized = cell.toLowerCase();
  if (/^(fecha|date|work date|dia)$/.test(normalized)) return 100;
  return 0;
}

function scoreGrossCell(cell: string): number {
  const normalized = cell.toLowerCase();
  if (/^(gross pay|gross|salario bruto|salario)$/.test(normalized)) return 100;
  if (/gross|salario/.test(normalized) && !/net/.test(normalized)) return 70;
  return 0;
}

function scoreNetCell(cell: string): number {
  const normalized = cell.toLowerCase();
  if (/^(net pay|net|salario neto|take home)$/.test(normalized)) return 100;
  if (/net\s*pay|neto/.test(normalized)) return 70;
  return 0;
}

function scorePayrollAmountCell(cell: string): number {
  const normalized = cell.toLowerCase();
  if (/tips?|propinas?|horas?|hours|overtime|rate|fecha|date|employee|empleado/.test(normalized)) {
    return 0;
  }
  if (/^(payroll|total pay|amount|pago|earning)$/.test(normalized)) return 90;
  return 0;
}

function bestColumn(
  headers: string[],
  scorer: (cell: string) => number,
): number | null {
  let bestIdx: number | null = null;
  let bestScore = 0;
  for (let i = 0; i < headers.length; i++) {
    const score = scorer(headers[i] ?? "");
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore > 0 ? bestIdx : null;
}

type PdfTable = {
  headerIdx: number;
  headers: string[];
  employeeCol: number;
  dateCol: number | null;
  hoursCols: ReturnType<typeof detectHoursColumns>;
  overtimeCol: number | null;
  tipsCol: number | null;
  grossCol: number | null;
  netCol: number | null;
  payrollCol: number | null;
};

function scoreOvertimeCell(cell: string): number {
  const h = normalizePayrollHeader(cell);
  if (/horas?\s*extra|overtime|\bot\b/.test(h)) return 100;
  return 0;
}

function detectPdfTable(lines: string[], startIdx: number): PdfTable | null {
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 30); i++) {
    const cells = splitPayrollRow(lines[i] ?? "");
    if (cells.length < 2) continue;

    const employeeCol = bestColumn(cells, scoreEmployeeCell);
    if (employeeCol == null) continue;

    const hoursCols = detectHoursColumns(cells);
    const hasPayrollSignal =
      hoursCols.workedHoursCol != null ||
      hoursCols.clockInCol != null ||
      bestColumn(cells, scoreGrossCell) != null ||
      bestColumn(cells, scoreNetCell) != null;

    if (!hasPayrollSignal) continue;

    return {
      headerIdx: i,
      headers: cells,
      employeeCol,
      dateCol: bestColumn(cells, scoreDateCell),
      hoursCols,
      overtimeCol: bestColumn(cells, scoreOvertimeCell),
      tipsCol: bestColumn(cells, (cell) =>
        /tips?|propinas?/.test(cell.toLowerCase()) ? 100 : 0,
      ),
      grossCol: bestColumn(cells, scoreGrossCell),
      netCol: bestColumn(cells, scoreNetCell),
      payrollCol: bestColumn(cells, scorePayrollAmountCell),
    };
  }

  return null;
}

function parseNumericCell(value: string): number | null {
  if (!value || PAYROLL_FORMULA_ERROR.test(value)) return null;
  return parseMoney(value);
}

function inferEmployeeColumn(cells: string[]): number {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] ?? "";
    if (isSkipPayrollEmployeeName(cell)) continue;
    if (/^\d+([.,]\d+)?$/.test(cell)) continue;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cell)) continue;
    if (/^\d{1,2}:\d{2}/.test(cell)) continue;
    if (cell.length >= 3 && /[A-Za-zÁÉÍÓÚáéíóú]/.test(cell)) {
      return i;
    }
  }
  return 0;
}

function rowLooksLikeHeader(cells: string[]): boolean {
  const headerHits = cells.filter((cell) => scoreEmployeeCell(cell) >= 90).length;
  return headerHits >= 1 && cells.length >= 3;
}

export function extractPayrollFromPdfText(
  text: string,
  params: {
    titleHint: string;
    fallbackPeriod: string | null;
    uploadDate: string;
  },
): ExtractionProfileResult | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const employees = new Map<string, PayrollEmployeeAccumulator>();
  const seenFingerprints = new Set<string>();
  let rowsIncluded = 0;
  let rowsSkipped = 0;
  let rowsDeduplicated = 0;
  let hasPayrollColumn = false;
  let hasHoursOrTips = false;
  let labeledPayrollTotal: number | null = null;
  let tablesFound = 0;

  const processedHeaders = new Set<number>();

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    if (processedHeaders.has(lineIdx)) continue;

    const table = detectPdfTable(lines, lineIdx);
    if (!table) continue;

    processedHeaders.add(table.headerIdx);

    tablesFound += 1;
    logPayrollPdf("payroll_pdf_table_detected", {
      headerIdx: table.headerIdx,
      headers: table.headers,
      employeeCol: table.employeeCol,
      detectedHourColumns: table.hoursCols.detectedHourColumns,
    });

    if (table.payrollCol != null || table.grossCol != null || table.netCol != null) {
      hasPayrollColumn = true;
    }
    if (
      table.hoursCols.workedHoursCol != null ||
      table.hoursCols.clockInCol != null ||
      table.tipsCol != null
    ) {
      hasHoursOrTips = true;
    }

    for (let i = table.headerIdx + 1; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (!line.trim()) {
        rowsSkipped += 1;
        continue;
      }

      const cells = splitPayrollRow(line);
      if (!cells.length) {
        rowsSkipped += 1;
        continue;
      }

      if (rowLooksLikeHeader(cells)) {
        processedHeaders.add(i);
        break;
      }

      if (SKIP_LINE.test(cells[0] ?? "") || SKIP_LINE.test(line)) {
        rowsSkipped += 1;
        const totalValue =
          table.payrollCol != null
            ? parseNumericCell(cells[table.payrollCol] ?? "")
            : table.grossCol != null
              ? parseNumericCell(cells[table.grossCol] ?? "")
              : null;
        if (totalValue != null) labeledPayrollTotal = totalValue;
        continue;
      }

      const employeeCol =
        table.employeeCol < cells.length ? table.employeeCol : inferEmployeeColumn(cells);
      const name = (cells[employeeCol] ?? "").trim();
      if (isSkipPayrollEmployeeName(name)) {
        rowsSkipped += 1;
        continue;
      }

      const dateValue =
        table.dateCol != null ? (cells[table.dateCol] ?? "").trim() : null;
      if (table.dateCol != null && !dateValue) {
        rowsSkipped += 1;
        continue;
      }

      const rowValues = cells.map((cell) => cell as unknown);
      const hours = resolveRowWorkedHours({
        row: rowValues,
        workedHoursCol: table.hoursCols.workedHoursCol,
        clockInCol: table.hoursCols.clockInCol,
        clockOutCol: table.hoursCols.clockOutCol,
        breakCol: table.hoursCols.breakCol,
      });

      const overtime =
        table.overtimeCol != null
          ? normalizeWorkedHoursValue(cells[table.overtimeCol], {
              isWorkedHoursColumn: true,
            })
          : null;
      const tips =
        table.tipsCol != null ? parseNumericCell(cells[table.tipsCol] ?? "") : null;
      const grossPay =
        table.grossCol != null ? parseNumericCell(cells[table.grossCol] ?? "") : null;
      const netPay =
        table.netCol != null ? parseNumericCell(cells[table.netCol] ?? "") : null;
      const payroll =
        table.payrollCol != null
          ? parseNumericCell(cells[table.payrollCol] ?? "")
          : null;

      const fingerprint = buildShiftFingerprint({
        employeeKey: normalizePayrollEmployeeKey(name),
        date: dateValue,
        clockIn:
          table.hoursCols.clockInCol != null
            ? (cells[table.hoursCols.clockInCol] ?? null)
            : null,
        clockOut:
          table.hoursCols.clockOutCol != null
            ? (cells[table.hoursCols.clockOutCol] ?? null)
            : null,
        hours,
        area: null,
      });

      if (seenFingerprints.has(fingerprint)) {
        rowsDeduplicated += 1;
        continue;
      }

      seenFingerprints.add(fingerprint);
      rowsIncluded += 1;

      applyPayrollShift(employees, {
        employeeKey: normalizePayrollEmployeeKey(name),
        displayName: name.replace(/\s+/g, " "),
        hours,
        overtime,
        tips,
        grossPay,
        netPay,
        payroll,
        fingerprint,
      });
    }

    lineIdx = Math.max(lineIdx, table.headerIdx);
  }

  const employeeSummaries = finalizePayrollEmployees(employees);
  const employeeCount = employeeSummaries.length;

  logPayrollPdf("payroll_pdf_summary", {
    tablesFound,
    employeeCount,
    rowsIncluded,
    rowsSkipped,
    rowsDeduplicated,
  });

  if (employeeCount === 0 && !hasHoursOrTips && !hasPayrollColumn) {
    return null;
  }

  return buildPayrollProfileResult({
    employees: employeeSummaries,
    accumulators: employees,
    period: params.fallbackPeriod,
    titleHint: params.titleHint,
    uploadDate: params.uploadDate,
    sourceFormat: "pdf",
    sourceSystem: "payroll_pdf",
    hasPayrollColumn,
    hasHoursOrTips,
    labeledPayrollTotal,
    extractionDiagnostics: {
      unique_employee_count: employeeCount,
      total_hours: employeeSummaries.reduce(
        (sum, employee) => sum + (employee.total_hours ?? 0),
        0,
      ),
      total_tips: employeeSummaries.reduce(
        (sum, employee) => sum + (employee.total_tips ?? 0),
        0,
      ),
      rows_included: rowsIncluded,
      rows_skipped: rowsSkipped,
      rows_deduplicated: rowsDeduplicated,
      unique_shift_rows: seenFingerprints.size,
      sheets_processed: [`pdf_text_tables:${tablesFound}`],
      sheets_skipped: [],
      sheet_summaries: [],
    },
  });
}
