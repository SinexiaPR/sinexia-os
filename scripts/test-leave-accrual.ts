import assert from "node:assert/strict";

import {
  DEFAULT_SICK_BALANCE_CAP_HOURS,
  enumerateMonths,
  monthsOfService,
  monthQualifies,
  payMonthFor,
  qualifyingHoursFromCategories,
  replayLeaveHistory,
  tenureTierFromMonths,
  type HourCategoryInput,
  type MonthLedgerInput,
} from "../src/lib/leave-accrual/calculations";

function categories(overrides: Partial<HourCategoryInput> = {}): HourCategoryInput {
  return {
    regularHours: 0,
    trainingHours: 0,
    vacationPaidHours: 0,
    sickPaidHours: 0,
    holidayPaidHours: 0,
    juryDutyHours: 0,
    bereavementHours: 0,
    ...overrides,
  };
}

function month(
  overrides: Partial<MonthLedgerInput> & { year: number; month: number },
): MonthLedgerInput {
  return {
    qualifyingHours: 0,
    vacationUsedHours: 0,
    sickUsedHours: 0,
    ...overrides,
  };
}

// --- 130-hour monthly qualification threshold ---
assert.equal(monthQualifies(129.99), false, "just under 130 must not qualify");
assert.equal(monthQualifies(130), true, "exactly 130 must qualify");
assert.equal(monthQualifies(130.01), true, "over 130 must qualify");
assert.equal(
  qualifyingHoursFromCategories(
    categories({ regularHours: 100, vacationPaidHours: 30 }),
  ),
  130,
  "qualifying hours must sum all categories, including vacation/sick usage",
);

// --- tenure tier boundaries (in months) ---
assert.equal(tenureTierFromMonths(11), "under_1");
assert.equal(tenureTierFromMonths(12), "one_to_five");
assert.equal(tenureTierFromMonths(59), "one_to_five");
assert.equal(tenureTierFromMonths(60), "five_to_fifteen");
assert.equal(tenureTierFromMonths(179), "five_to_fifteen");
assert.equal(tenureTierFromMonths(180), "over_fifteen");
assert.equal(monthsOfService("2025-01-15", 2026, 1), 12);
assert.equal(monthsOfService("2025-01-15", 2025, 12), 11);

// --- replay: no accrual below threshold ---
{
  const results = replayLeaveHistory({
    hiringDate: "2025-01-01",
    months: [month({ year: 2025, month: 1, qualifyingHours: 120 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].qualifies, false);
  assert.equal(results[0].vacationAccruedHours, 0);
  assert.equal(results[0].sickAccruedHours, 0);
}

// --- replay: qualifies at exactly 130, under-1-year tier accrues 4h vacation + 8h sick ---
{
  const results = replayLeaveHistory({
    hiringDate: "2025-01-01",
    months: [month({ year: 2025, month: 3, qualifyingHours: 130 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].qualifies, true);
  assert.equal(results[0].tenureTier, "under_1");
  assert.equal(results[0].vacationAccruedHours, 4);
  assert.equal(results[0].sickAccruedHours, 8);
  assert.equal(results[0].vacationBalanceAfterHours, 4);
  assert.equal(results[0].sickBalanceAfterHours, 8);
}

// --- replay: tenure tiers accrue the right amount across a hiring-date boundary ---
{
  const results = replayLeaveHistory({
    hiringDate: "2024-01-01",
    months: [
      month({ year: 2024, month: 12, qualifyingHours: 130 }), // 11 months -> under_1
      month({ year: 2025, month: 1, qualifyingHours: 130 }), // 12 months -> one_to_five
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].tenureTier, "under_1");
  assert.equal(results[0].vacationAccruedHours, 4);
  assert.equal(results[1].tenureTier, "one_to_five");
  assert.equal(results[1].vacationAccruedHours, 6);
  assert.equal(results[1].vacationBalanceAfterHours, 10);
}

// --- replay: sick balance cap, default and custom, including overflow ---
{
  const months = enumerateMonths(2025, 1, 2026, 4).map(({ year, month: m }) =>
    month({ year, month: m, qualifyingHours: 130 }),
  );
  assert.equal(months.length, 16);

  const defaultCap = replayLeaveHistory({
    hiringDate: "2020-01-01",
    months,
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  // 16 qualifying months * 8h = 128h, capped at 120h from month 15 onward.
  assert.equal(defaultCap[14].sickBalanceAfterHours, 120);
  assert.equal(defaultCap[15].sickBalanceAfterHours, 120, "sick balance must not exceed the cap");

  const customCap = replayLeaveHistory({
    hiringDate: "2020-01-01",
    months,
    sickBalanceCapHours: 40,
  });
  assert.equal(customCap[4].sickBalanceAfterHours, 40, "custom cap must be respected");
  assert.equal(customCap[15].sickBalanceAfterHours, 40);
}

// --- replay: vacation usage exceeding balance clamps to 0, never negative ---
{
  const results = replayLeaveHistory({
    hiringDate: "2025-01-01",
    months: [
      month({ year: 2025, month: 6, qualifyingHours: 130, vacationUsedHours: 30 }),
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  // Qualifies (130 total, including the 30 used hours), accrues 4h vacation,
  // but 30h were used the same month.
  assert.equal(results[0].vacationAccruedHours, 4);
  assert.equal(results[0].vacationUsedHours, 30);
  assert.equal(
    results[0].vacationBalanceAfterHours,
    0,
    "vacation balance must clamp at 0, never go negative",
  );
}

// --- replay: a zero-hour gap month has no effect, tier is calendar-based ---
{
  const results = replayLeaveHistory({
    hiringDate: "2024-06-01",
    months: [
      month({ year: 2024, month: 7, qualifyingHours: 130 }),
      month({ year: 2024, month: 8 }), // gap month: no payroll activity at all
      month({ year: 2025, month: 7, qualifyingHours: 130 }), // 13 months elapsed -> one_to_five
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[1].qualifies, false);
  assert.equal(results[1].vacationAccruedHours, 0);
  assert.equal(results[2].tenureTier, "one_to_five");
  assert.equal(results[2].vacationAccruedHours, 6);
}

// --- replay: determinism (running twice on identical input yields identical output) ---
{
  const input = {
    hiringDate: "2022-03-15",
    months: [
      month({ year: 2023, month: 1, qualifyingHours: 140, sickUsedHours: 8 }),
      month({ year: 2023, month: 2, qualifyingHours: 100 }),
      month({ year: 2023, month: 3, qualifyingHours: 135, vacationUsedHours: 8 }),
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  };
  assert.deepEqual(replayLeaveHistory(input), replayLeaveHistory(input));
}

// --- replay: opening balance seeds the running balance before month 1 ---
{
  const results = replayLeaveHistory({
    hiringDate: "2021-01-01",
    months: [month({ year: 2026, month: 8, qualifyingHours: 130 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
    openingVacationHours: 50,
    openingSickHours: 60,
  });
  assert.equal(results[0].tenureTier, "five_to_fifteen", "tier still comes from hiringDate, not the opening balance");
  assert.equal(results[0].vacationAccruedHours, 8);
  assert.equal(results[0].vacationBalanceAfterHours, 58, "50 opening + 8 accrued");
  assert.equal(results[0].sickBalanceAfterHours, 68, "60 opening + 8 accrued");
}

// --- replay: opening balance still respects the sick cap and vacation clamp ---
{
  const results = replayLeaveHistory({
    hiringDate: "2021-01-01",
    months: [
      month({ year: 2026, month: 8, qualifyingHours: 130, vacationUsedHours: 200 }),
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
    openingVacationHours: 150,
    openingSickHours: 118,
  });
  assert.equal(
    results[0].vacationBalanceAfterHours,
    0,
    "150 opening + 8 accrued - 200 used must clamp at 0, never negative",
  );
  assert.equal(
    results[0].sickBalanceAfterHours,
    DEFAULT_SICK_BALANCE_CAP_HOURS,
    "118 opening + 8 accrued must clamp at the cap, not 126",
  );
}

// --- replay: no opening balance defaults to starting from zero (unchanged behavior) ---
{
  const results = replayLeaveHistory({
    hiringDate: "2025-01-01",
    months: [month({ year: 2025, month: 3, qualifyingHours: 130 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].vacationBalanceAfterHours, 4);
  assert.equal(results[0].sickBalanceAfterHours, 8);
}

// --- payMonthFor / enumerateMonths ---
assert.deepEqual(payMonthFor("2026-02-03"), { year: 2026, month: 2 });
assert.deepEqual(enumerateMonths(2025, 11, 2026, 2), [
  { year: 2025, month: 11 },
  { year: 2025, month: 12 },
  { year: 2026, month: 1 },
  { year: 2026, month: 2 },
]);
assert.deepEqual(enumerateMonths(2026, 5, 2026, 5), [{ year: 2026, month: 5 }]);

console.log("Leave accrual calculations: PASS");
