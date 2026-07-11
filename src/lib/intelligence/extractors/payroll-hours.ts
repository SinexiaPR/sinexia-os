const FORMULA_ERROR = /^#(NAME\?|REF!|VALUE!|DIV\/0!|N\/A|NULL!|NUM!)/i;
const CLOCK_TIME =
  /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i;
const SUMMARY_SHEET =
  /^(resumen|summary|totals?|weekly|semanal|consolidado|pivot|helper|template|backup|copia|data\s*-\s*)/i;

export type HoursColumnSelection = {
  workedHoursCol: number | null;
  clockInCol: number | null;
  clockOutCol: number | null;
  breakCol: number | null;
  detectedHourColumns: string[];
};

export type SheetTier = "detail" | "summary" | "skip";

export function normalizePayrollHeader(cell: string): string {
  return cell
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isSummarySheetName(sheetName: string): boolean {
  return SUMMARY_SHEET.test(sheetName.trim());
}

export function classifySheetTier(
  sheetName: string,
  hasEmployeeColumn: boolean,
  hasDateOrShiftColumn: boolean,
): SheetTier {
  if (!hasEmployeeColumn) return "skip";
  if (isSummarySheetName(sheetName) && !hasDateOrShiftColumn) return "summary";
  if (isSummarySheetName(sheetName)) return "summary";
  return "detail";
}

const ALLOWED_HOURS_HEADERS = new Set([
  "horas",
  "hours",
  "horas trabajadas",
  "worked hours",
  "regular hours",
  "shift hours",
  "total horas",
  "total horas turno",
]);

function isExcludedHoursHeader(normalized: string): boolean {
  if (ALLOWED_HOURS_HEADERS.has(normalized)) return false;
  return /rate|tarifa|salary|salario|gross|net|pay|payroll|pago|tips?|propinas?|fecha|date|turno|shift|area|notas|count|employee|empleado|nombre|start|end|time in|time out|clock|entrada|salida|lunch|break|descanso|almuerzo|subtotal|grand total|total tips|tips total/.test(
    normalized,
  );
}

function scoreWorkedHoursHeader(normalized: string): number {
  if (isExcludedHoursHeader(normalized)) return 0;
  if (normalized === "horas" || normalized === "hours") return 100;
  if (normalized === "horas trabajadas" || normalized === "worked hours") return 98;
  if (normalized === "regular hours" || normalized === "shift hours") return 96;
  if (normalized === "total horas") return 90;
  if (normalized === "total horas turno") return 70;
  return 0;
}

function scoreClockInHeader(normalized: string): number {
  if (/^(time in|clock in|entrada|hora entrada|inicio|start)$/.test(normalized)) {
    return 100;
  }
  if (/entrada|clock\s*in|time\s*in|^in$/.test(normalized) && !/salida|out/.test(normalized)) {
    return 80;
  }
  return 0;
}

function scoreClockOutHeader(normalized: string): number {
  if (/^(time out|clock out|salida|hora salida|fin|end)$/.test(normalized)) {
    return 100;
  }
  if (/salida|clock\s*out|time\s*out|^out$/.test(normalized) && !/entrada|in/.test(normalized)) {
    return 80;
  }
  return 0;
}

function scoreBreakHeader(normalized: string): number {
  if (/^(break|lunch|descanso|almuerzo|break minutes|break hours)$/.test(normalized)) {
    return 100;
  }
  return 0;
}

function bestColumn(
  headers: string[],
  scorer: (normalized: string) => number,
): number | null {
  let bestIdx: number | null = null;
  let bestScore = 0;

  for (let i = 0; i < headers.length; i++) {
    const score = scorer(normalizePayrollHeader(headers[i] ?? ""));
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestScore > 0 ? bestIdx : null;
}

export function detectHoursColumns(headers: string[]): HoursColumnSelection {
  const normalized = headers.map((header) => normalizePayrollHeader(header));
  const detectedHourColumns = headers.filter((header, index) => {
    return scoreWorkedHoursHeader(normalized[index] ?? "") > 0;
  });

  const workedHoursCol = bestColumn(headers, scoreWorkedHoursHeader);
  const clockInCol = bestColumn(headers, scoreClockInHeader);
  const clockOutCol = bestColumn(headers, scoreClockOutHeader);
  const breakCol = bestColumn(headers, scoreBreakHeader);

  return {
    workedHoursCol,
    clockInCol,
    clockOutCol,
    breakCol,
    detectedHourColumns,
  };
}

export function isDurationCellFormat(format: string | undefined): boolean {
  if (!format) return false;
  const fmt = format.toLowerCase();
  return (
    fmt.includes("[h]") ||
    fmt.includes("h:mm") ||
    fmt.includes("hh:mm") ||
    fmt.includes("[mm]") ||
    fmt.includes("duration")
  );
}

export function parseClockTimeToHours(value: unknown): number | null {
  if (value instanceof Date) {
    return (
      value.getUTCHours() +
      value.getUTCMinutes() / 60 +
      value.getUTCSeconds() / 3600
    );
  }

  const raw = String(value ?? "").trim();
  if (!raw || FORMULA_ERROR.test(raw)) return null;

  const match = raw.match(CLOCK_TIME);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[4]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return hours + minutes / 60;
}

export function normalizeWorkedHoursValue(
  value: unknown,
  options?: { cellFormat?: string; isWorkedHoursColumn?: boolean },
): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (FORMULA_ERROR.test(String(value))) return null;

    const format = options?.cellFormat;
    const treatAsDuration =
      options?.isWorkedHoursColumn !== false ||
      isDurationCellFormat(format);

    if (value > 24) return null;

    if (value >= 1 && value <= 24) {
      return Number(value.toFixed(4));
    }

    if (value > 0 && value < 1 && treatAsDuration) {
      const converted = value * 24;
      if (converted > 0 && converted <= 24) {
        return Number(converted.toFixed(4));
      }
      return Number(value.toFixed(4));
    }

    if (value >= 0 && value <= 24) {
      return Number(value.toFixed(4));
    }

    return null;
  }

  if (value instanceof Date) {
    if (options?.isWorkedHoursColumn) {
      const asHours = normalizeWorkedHoursValue(
        value.getUTCHours() +
          value.getUTCMinutes() / 60 +
          value.getUTCSeconds() / 3600,
      );
      return asHours;
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw || FORMULA_ERROR.test(raw)) return null;

  const money = Number(raw.replace(/,/g, ""));
  if (Number.isFinite(money) && raw.match(/^[\d,.]+$/)) {
    return normalizeWorkedHoursValue(money, options);
  }

  const clock = parseClockTimeToHours(raw);
  if (clock != null && options?.isWorkedHoursColumn === false) {
    return clock;
  }

  return null;
}

export function computeClockPairHours(
  clockIn: unknown,
  clockOut: unknown,
  breakValue: unknown,
  options?: { breakIsMinutes?: boolean },
): number | null {
  const start = parseClockTimeToHours(clockIn);
  const end = parseClockTimeToHours(clockOut);
  if (start == null || end == null) return null;

  let duration = end - start;
  if (duration < 0) duration += 24;

  if (breakValue != null && breakValue !== "") {
    if (typeof breakValue === "number" && Number.isFinite(breakValue)) {
      duration -= options?.breakIsMinutes ? breakValue / 60 : breakValue;
    } else {
      const breakHours = normalizeWorkedHoursValue(breakValue);
      if (breakHours != null) duration -= breakHours;
    }
  }

  if (duration <= 0 || duration > 24) return null;
  return Number(duration.toFixed(4));
}

export function resolveRowWorkedHours(params: {
  row: unknown[];
  workedHoursCol: number | null;
  clockInCol: number | null;
  clockOutCol: number | null;
  breakCol: number | null;
  getCellFormat?: (rowIdx: number, colIdx: number) => string | undefined;
  rowIdx?: number;
}): number | null {
  const {
    row,
    workedHoursCol,
    clockInCol,
    clockOutCol,
    breakCol,
    getCellFormat,
    rowIdx = -1,
  } = params;

  if (workedHoursCol != null) {
    const value = row[workedHoursCol];
    const format =
      rowIdx >= 0 ? getCellFormat?.(rowIdx, workedHoursCol) : undefined;
    const hours = normalizeWorkedHoursValue(value, {
      cellFormat: format,
      isWorkedHoursColumn: true,
    });
    if (hours != null) return hours;
  }

  if (clockInCol != null && clockOutCol != null) {
    const breakHeader =
      breakCol != null
        ? normalizePayrollHeader(String(row[breakCol] ?? ""))
        : "";
    return computeClockPairHours(
      row[clockInCol],
      row[clockOutCol],
      breakCol != null ? row[breakCol] : null,
      { breakIsMinutes: /minute|minuto/.test(breakHeader) },
    );
  }

  return null;
}

export function buildShiftFingerprint(parts: {
  employeeKey: string;
  date: string | null;
  clockIn: string | null;
  clockOut: string | null;
  hours: number | null;
  area: string | null;
}): string {
  return [
    parts.employeeKey,
    parts.date ?? "",
    parts.clockIn ?? "",
    parts.clockOut ?? "",
    parts.hours != null ? parts.hours.toFixed(2) : "",
    parts.area ?? "",
  ].join("|");
}
