/**
 * Puerto Rico vacation/sick leave accrual math. Pure, framework-agnostic —
 * no Supabase/Next imports so it can be unit-tested and shared between the
 * Sibarita and Tresbe payroll systems, which have no other code in common.
 */

export type TenureTier =
  | "under_1"
  | "one_to_five"
  | "five_to_fifteen"
  | "over_fifteen";

export const QUALIFYING_HOURS_THRESHOLD = 130;
export const SICK_ACCRUAL_HOURS_PER_MONTH = 8;
export const DEFAULT_SICK_BALANCE_CAP_HOURS = 120;

export const VACATION_ACCRUAL_HOURS_BY_TIER: Record<TenureTier, number> = {
  under_1: 4,
  one_to_five: 6,
  five_to_fifteen: 8,
  over_fifteen: 10,
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function parseYearMonth(dateStr: string): { year: number; month: number } {
  const [year, month] = dateStr.split("-").map(Number);
  return { year, month };
}

/** Whole calendar months elapsed between hiring month and the given month (can be 0). */
export function monthsOfService(
  hiringDate: string,
  asOfYear: number,
  asOfMonth: number,
): number {
  const hiring = parseYearMonth(hiringDate);
  return (asOfYear - hiring.year) * 12 + (asOfMonth - hiring.month);
}

export function tenureTierFromMonths(monthsOfServiceValue: number): TenureTier {
  if (monthsOfServiceValue < 12) return "under_1";
  if (monthsOfServiceValue < 60) return "one_to_five";
  if (monthsOfServiceValue < 180) return "five_to_fifteen";
  return "over_fifteen";
}

export function yearsOfServiceFromMonths(monthsOfServiceValue: number): number {
  return round2(monthsOfServiceValue / 12);
}

/** Raw hour categories for a single payroll entry, as entered on a weekly payroll. */
export type HourCategoryInput = {
  regularHours: number;
  trainingHours: number;
  vacationPaidHours: number;
  sickPaidHours: number;
  holidayPaidHours: number;
  juryDutyHours: number;
  bereavementHours: number;
};

/** Sums every category that counts toward the 130-hour monthly threshold. */
export function qualifyingHoursFromCategories(input: HourCategoryInput): number {
  return (
    input.regularHours +
    input.trainingHours +
    input.vacationPaidHours +
    input.sickPaidHours +
    input.holidayPaidHours +
    input.juryDutyHours +
    input.bereavementHours
  );
}

export function monthQualifies(totalQualifyingHours: number): boolean {
  return totalQualifyingHours >= QUALIFYING_HOURS_THRESHOLD;
}

/**
 * One calendar month's already-aggregated contribution to an employee's
 * leave ledger (the sum of every payroll entry that landed in that month).
 * Callers build this from `employee_leave_ledger_entries` rows, using
 * `qualifyingHoursFromCategories` per entry before aggregating.
 */
export type MonthLedgerInput = {
  year: number;
  month: number;
  qualifyingHours: number;
  vacationUsedHours: number;
  sickUsedHours: number;
};

export type MonthAccrualResult = {
  year: number;
  month: number;
  qualifyingHours: number;
  qualifies: boolean;
  monthsOfService: number;
  yearsOfService: number;
  tenureTier: TenureTier;
  vacationAccruedHours: number;
  sickAccruedHours: number;
  vacationUsedHours: number;
  sickUsedHours: number;
  vacationBalanceAfterHours: number;
  sickBalanceAfterHours: number;
  sickCapHoursApplied: number;
};

/**
 * Recomputes an employee's entire leave history from scratch, month by
 * month, in chronological order. This is deliberately a full replay rather
 * than an incremental update: hiring_date can be edited later (shifting
 * every tier boundary) and payrolls can be reopened/edited months after the
 * fact (changing a past month's qualifying hours), so only a from-scratch,
 * order-dependent replay is guaranteed correct — an incremental "+=" balance
 * cannot safely absorb either kind of retroactive change.
 *
 * `months` should be the full contiguous sequence from the hiring month
 * through the latest month with ledger activity, including zero-hour gap
 * months (the caller builds this via `enumerateMonths`), so history rows
 * exist for every month even when nothing happened that month. Omitting a
 * genuinely zero-hour month has no effect on the resulting balances (tier
 * is computed from the calendar date, not from the count of prior months),
 * but including it keeps a complete monthly audit trail.
 */
export function replayLeaveHistory(params: {
  hiringDate: string;
  months: MonthLedgerInput[];
  sickBalanceCapHours: number;
}): MonthAccrualResult[] {
  const sorted = [...params.months].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  let vacationBalance = 0;
  let sickBalance = 0;
  const results: MonthAccrualResult[] = [];

  for (const monthInput of sorted) {
    const months = monthsOfService(
      params.hiringDate,
      monthInput.year,
      monthInput.month,
    );
    const tier = tenureTierFromMonths(months);
    const totalQualifyingHours = round2(monthInput.qualifyingHours);
    const qualifies = monthQualifies(totalQualifyingHours);

    const vacationAccrued = qualifies ? VACATION_ACCRUAL_HOURS_BY_TIER[tier] : 0;
    const sickAccrued = qualifies ? SICK_ACCRUAL_HOURS_PER_MONTH : 0;
    const vacationUsed = round2(monthInput.vacationUsedHours);
    const sickUsed = round2(monthInput.sickUsedHours);

    vacationBalance = Math.max(
      0,
      round2(vacationBalance + vacationAccrued - vacationUsed),
    );
    sickBalance = Math.min(
      params.sickBalanceCapHours,
      Math.max(0, round2(sickBalance + sickAccrued - sickUsed)),
    );

    results.push({
      year: monthInput.year,
      month: monthInput.month,
      qualifyingHours: totalQualifyingHours,
      qualifies,
      monthsOfService: months,
      yearsOfService: yearsOfServiceFromMonths(months),
      tenureTier: tier,
      vacationAccruedHours: vacationAccrued,
      sickAccruedHours: sickAccrued,
      vacationUsedHours: vacationUsed,
      sickUsedHours: sickUsed,
      vacationBalanceAfterHours: vacationBalance,
      sickBalanceAfterHours: sickBalance,
      sickCapHoursApplied: params.sickBalanceCapHours,
    });
  }

  return results;
}

/** Attributes a weekly pay period to the calendar month of its closing date. */
export function payMonthFor(weekEnd: string): { year: number; month: number } {
  return parseYearMonth(weekEnd);
}

/** Builds the contiguous [from, to] month sequence (inclusive), for filling gap months. */
export function enumerateMonths(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): Array<{ year: number; month: number }> {
  const result: Array<{ year: number; month: number }> = [];
  let year = fromYear;
  let month = fromMonth;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    result.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}
