import {
  buildSummary,
  confidenceFromFields,
  parseMoney,
} from "@/lib/intelligence/extractors/base";
import type { ExtractionProfileResult } from "@/lib/intelligence/profiles/types";

const EMPLOYEE_HEADER =
  /employee|empleado|nombre|name|staff|worker|trabajador|associate/i;
const PAY_HEADER =
  /gross|net\s*pay|net|pay|amount|salary|salario|wage|pago|earning|total/i;
const HOURS_HEADER = /hours?|horas/i;
const SKIP_NAME = /^(total|subtotal|grand|suma|totales?|headers?)$/i;

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseNumericCell(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return parseMoney(value);
  return null;
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

    let employeeCount = 0;
    let totalPayroll: number | null = null;
    let labeledTotal: number | null = null;

    for (const sheetName of workbook.SheetNames.slice(0, 10)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];

      if (!matrix.length) continue;

      let headerIdx = -1;
      let nameCol = -1;
      let payCol = -1;

      for (let i = 0; i < Math.min(matrix.length, 40); i++) {
        const row = (matrix[i] ?? []).map(cellStr);
        const nameIdx = row.findIndex((cell) => EMPLOYEE_HEADER.test(cell));
        const payIdx = row.findIndex(
          (cell) => PAY_HEADER.test(cell) && !HOURS_HEADER.test(cell),
        );
        if (nameIdx >= 0 && payIdx >= 0) {
          headerIdx = i;
          nameCol = nameIdx;
          payCol = payIdx;
          break;
        }
      }

      if (headerIdx < 0) continue;

      let sheetSum = 0;
      let sheetEmployees = 0;

      for (let i = headerIdx + 1; i < Math.min(matrix.length, 2002); i++) {
        const row = matrix[i] ?? [];
        const name = cellStr(row[nameCol]);
        const pay = payCol >= 0 ? parseNumericCell(row[payCol]) : null;

        if (!name) continue;

        if (SKIP_NAME.test(name)) {
          if (pay != null) labeledTotal = pay;
          continue;
        }

        sheetEmployees += 1;
        if (pay != null && pay > 0) {
          sheetSum += pay;
        }
      }

      if (sheetEmployees > 0) {
        employeeCount += sheetEmployees;
        totalPayroll = (totalPayroll ?? 0) + sheetSum;
      }
    }

    if (labeledTotal != null) {
      totalPayroll = labeledTotal;
    }

    if (employeeCount === 0 && totalPayroll == null) {
      return null;
    }

    const structuredData = {
      company: null,
      period: params.fallbackPeriod,
      employee_count: employeeCount || null,
      total_payroll:
        totalPayroll != null ? Number(totalPayroll.toFixed(2)) : null,
      total_hours: null,
      overtime_hours: null,
      total_tips: null,
      source_document: params.titleHint,
      upload_date: params.uploadDate,
      source_system: "payroll_excel",
    };

    return {
      documentType: "payroll",
      period: params.fallbackPeriod,
      structuredData,
      summary: buildSummary([
        totalPayroll != null
          ? `Nómina total: $${totalPayroll.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null,
        employeeCount ? `${employeeCount} empleados` : null,
      ]),
      confidence: confidenceFromFields([totalPayroll, employeeCount]),
    };
  } catch {
    return null;
  }
}
