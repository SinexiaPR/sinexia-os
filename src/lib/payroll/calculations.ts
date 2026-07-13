export type PayrollCalculationEntry = {
  compensation_type_snapshot:
    "hourly" | "hourly_training" | "fixed_weekly" | null;
  regular_rate_snapshot: number | null;
  training_rate_snapshot: number | null;
  fixed_salary_snapshot: number | null;
  regular_hours: number;
  training_hours: number;
  other_payments: number;
};

export function calculatePayrollEntry(entry: PayrollCalculationEntry) {
  const regular =
    Number(entry.regular_hours) * Number(entry.regular_rate_snapshot ?? 0);
  const training =
    Number(entry.training_hours) * Number(entry.training_rate_snapshot ?? 0);
  const fixed =
    entry.compensation_type_snapshot === "fixed_weekly"
      ? Number(entry.fixed_salary_snapshot ?? 0)
      : 0;
  return regular + training + fixed + Number(entry.other_payments);
}
