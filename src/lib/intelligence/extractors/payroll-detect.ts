import { normalizePayrollHeader } from "@/lib/intelligence/extractors/payroll-hours";

const PAYROLL_CATEGORY = /^payroll$/i;

const PAYROLL_TITLE =
  /n[oó]mina|payroll|time\s*card|timecard|homebase|hours?\s*worked|propinas|tips|empleados?|employees?/i;

const PAYROLL_TEXT =
  /n[oó]mina|payroll|empleado|employee|horas?\s*(trabajadas|extra|totales)?|regular\s*hours|overtime|gross\s*pay|net\s*pay|propinas|tips|salario|homebase|time\s*clock/i;

const PAYROLL_HEADERS =
  /^(empleado|employee|employee name|nombre|horas|hours|regular hours|overtime|horas extra|tips|propinas|gross pay|net pay|salario)$/i;

export type PayrollDetectionSignals = {
  reportCategory?: string | null;
  titleHint?: string | null;
  filename?: string | null;
  text?: string | null;
  sheetNames?: string[];
};

export function scorePayrollDocument(signals: PayrollDetectionSignals): number {
  let score = 0;

  if (signals.reportCategory && PAYROLL_CATEGORY.test(signals.reportCategory)) {
    score += 100;
  }

  if (signals.titleHint && PAYROLL_TITLE.test(signals.titleHint)) {
    score += 60;
  }

  if (signals.filename && PAYROLL_TITLE.test(signals.filename)) {
    score += 40;
  }

  if (signals.text && PAYROLL_TEXT.test(signals.text.slice(0, 8000))) {
    score += 35;
  }

  for (const sheetName of signals.sheetNames ?? []) {
    if (PAYROLL_TITLE.test(sheetName)) {
      score += 25;
      break;
    }
  }

  if (signals.text) {
    const lines = signals.text.split("\n").slice(0, 80);
    for (const line of lines) {
      const cells = line
        .split(/\t+| {2,}/)
        .map((cell) => normalizePayrollHeader(cell));
      const headerHits = cells.filter((cell) => PAYROLL_HEADERS.test(cell)).length;
      if (headerHits >= 2) {
        score += 50;
        break;
      }
    }
  }

  return score;
}

export function isLikelyPayrollDocument(signals: PayrollDetectionSignals): boolean {
  return scorePayrollDocument(signals) >= 60;
}
