import assert from "node:assert/strict";

import {
  currentTenureSnapshot,
  DEFAULT_SICK_BALANCE_CAP_HOURS,
  enumerateMonths,
  monthsOfService,
  monthQualifies,
  nextTierChangeDate,
  payMonthFor,
  qualifyingHoursFromCategories,
  replayLeaveHistory,
  splitHoursAcrossMonths,
  tenureTierAsOfDate,
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

// ============================================================
// Casos 1-13 (required scenarios from the Ley 180-1998 / Ley 4-2017 spec)
// ============================================================

// --- Caso 1: menos de 1 año, 129.99h -> 0 vacaciones, 0 enfermedad ---
{
  const results = replayLeaveHistory({
    hiringDate: "2025-06-01",
    months: [month({ year: 2025, month: 8, qualifyingHours: 129.99 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].qualifies, false);
  assert.equal(results[0].vacationAccruedHours, 0);
  assert.equal(results[0].sickAccruedHours, 0);
}

// --- Caso 2: menos de 1 año, 130h -> 4 vacaciones, 8 enfermedad ---
{
  const results = replayLeaveHistory({
    hiringDate: "2025-06-01",
    months: [month({ year: 2025, month: 8, qualifyingHours: 130 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].vacationAccruedHours, 4);
  assert.equal(results[0].sickAccruedHours, 8);
}

// --- Caso 3: 2 años, 130h -> 6 vacaciones, 8 enfermedad ---
{
  const results = replayLeaveHistory({
    hiringDate: "2023-01-01",
    months: [month({ year: 2025, month: 1, qualifyingHours: 130 })], // 24 months
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].tenureTier, "one_to_five");
  assert.equal(results[0].vacationAccruedHours, 6);
  assert.equal(results[0].sickAccruedHours, 8);
}

// --- Caso 4: 6 años, 130h -> 8 vacaciones, 8 enfermedad ---
{
  const results = replayLeaveHistory({
    hiringDate: "2019-01-01",
    months: [month({ year: 2025, month: 1, qualifyingHours: 130 })], // 72 months
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].tenureTier, "five_to_fifteen");
  assert.equal(results[0].vacationAccruedHours, 8);
  assert.equal(results[0].sickAccruedHours, 8);
}

// --- Caso 5: 15 años cumplidos, 130h -> 10 vacaciones, 8 enfermedad ---
{
  const results = replayLeaveHistory({
    hiringDate: "2010-01-01",
    months: [month({ year: 2025, month: 1, qualifyingHours: 130 })], // 180 months
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].tenureTier, "over_fifteen");
  assert.equal(results[0].vacationAccruedHours, 10);
  assert.equal(results[0].sickAccruedHours, 8);
}

// --- Caso 6: 180h no debe acreditar más que la tasa mensual fija ---
{
  const at130 = replayLeaveHistory({
    hiringDate: "2025-06-01",
    months: [month({ year: 2025, month: 8, qualifyingHours: 130 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  const at180 = replayLeaveHistory({
    hiringDate: "2025-06-01",
    months: [month({ year: 2025, month: 8, qualifyingHours: 180 })],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(
    at180[0].vacationAccruedHours,
    at130[0].vacationAccruedHours,
    "180h must accrue exactly the same as 130h — no bonus for exceeding the threshold",
  );
  assert.equal(at180[0].sickAccruedHours, at130[0].sickAccruedHours);
}

// --- Caso 7: horas de servicios profesionales nunca entran a horas computables ---
// qualifyingHoursFromCategories only ever receives "sistema"/W2 categories
// (see processing.ts: Tresbe passes system_hours, never total_weekly_hours;
// service-check hours never flow into this function at all) — so 40h of
// contractor/services pay is structurally excluded, not filtered out here.
// This asserts the 100h-only input correctly falls short of the threshold.
{
  const hours = qualifyingHoursFromCategories(categories({ regularHours: 100 }));
  assert.equal(hours, 100, "servicios profesionales hours must never be added in");
  assert.equal(monthQualifies(hours), false);
}

// --- Caso 8: nómina importada dos veces no debe duplicar ---
// Guaranteed by processing.ts's upsertLedgerRow using .upsert(...,
// { onConflict: "<entry_id>,period_year,period_month" }) rather than
// .insert(...) — re-processing the same payroll entry overwrites the same
// row instead of adding a new one. This requires a live database to exercise
// end-to-end and isn't covered by this pure-function suite; verified by
// code inspection (see processing.ts).

// --- Caso 9: corregir un mes anterior solo recalcula ese empleado/mes hacia adelante ---
{
  const original = replayLeaveHistory({
    hiringDate: "2024-01-01",
    months: [
      month({ year: 2024, month: 6, qualifyingHours: 130 }),
      month({ year: 2024, month: 7, qualifyingHours: 130 }),
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  const corrected = replayLeaveHistory({
    hiringDate: "2024-01-01",
    months: [
      month({ year: 2024, month: 6, qualifyingHours: 100 }), // corrected downward, no longer qualifies
      month({ year: 2024, month: 7, qualifyingHours: 130 }),
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(original[0].vacationAccruedHours, 4);
  assert.equal(corrected[0].vacationAccruedHours, 0, "the corrected month reflects the new hours");
  assert.equal(
    corrected[1].vacationBalanceAfterHours,
    corrected[0].vacationBalanceAfterHours + 4,
    "the balance after the correction propagates forward to subsequent months",
  );
  // replayAndPersistBalance (processing.ts) always scopes to a single
  // employeeId, so this correction can never touch another employee's row —
  // guaranteed by construction, not something a pure-function test can
  // exercise across employees.
}

// --- Caso 10: aniversario cambia solo la categoría de ese empleado; meses previos conservan la tasa anterior ---
{
  const hiringDate = "2025-08-15";
  assert.equal(tenureTierAsOfDate(hiringDate, "2026-08-14"), "under_1", "un día antes del aniversario");
  assert.equal(tenureTierAsOfDate(hiringDate, "2026-08-15"), "one_to_five", "el día exacto del aniversario");
  assert.equal(tenureTierAsOfDate(hiringDate, "2030-08-14"), "one_to_five");
  assert.equal(tenureTierAsOfDate(hiringDate, "2030-08-15"), "five_to_fifteen");
  assert.equal(tenureTierAsOfDate(hiringDate, "2040-08-14"), "five_to_fifteen");
  assert.equal(tenureTierAsOfDate(hiringDate, "2040-08-15"), "over_fifteen");

  assert.equal(nextTierChangeDate(hiringDate, "under_1"), "2026-08-15");
  assert.equal(nextTierChangeDate(hiringDate, "one_to_five"), "2030-08-15");
  assert.equal(nextTierChangeDate(hiringDate, "five_to_fifteen"), "2040-08-15");
  assert.equal(nextTierChangeDate(hiringDate, "over_fifteen"), null);

  const snapshot = currentTenureSnapshot(hiringDate, "2026-08-15");
  assert.equal(snapshot.tier, "one_to_five");
  assert.equal(snapshot.monthlyVacationRateHours, 6);
  assert.equal(snapshot.nextTierChangeDate, "2030-08-15");

  // Meses históricos ya calculados bajo la categoría anterior no se alteran:
  // el replay evalúa el tier mes a mes con monthsOfService (granularidad de
  // mes calendario), así que un mes ya cerrado con la tasa "under_1" sigue
  // igual salvo que ese mismo mes se recalcule explícitamente.
  const results = replayLeaveHistory({
    hiringDate: "2025-08-15",
    months: [
      month({ year: 2026, month: 7, qualifyingHours: 130 }), // aún under_1
      month({ year: 2026, month: 8, qualifyingHours: 130 }), // aniversario cae en este mes -> one_to_five
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].tenureTier, "under_1");
  assert.equal(results[0].vacationAccruedHours, 4);
  assert.equal(results[1].tenureTier, "one_to_five");
  assert.equal(results[1].vacationAccruedHours, 6);
}

// --- Caso 11: vacaciones utilizadas se restan una sola vez ---
{
  const results = replayLeaveHistory({
    hiringDate: "2024-01-01",
    months: [
      month({ year: 2024, month: 6, qualifyingHours: 130 }),
      month({ year: 2024, month: 7, qualifyingHours: 130, vacationUsedHours: 4 }),
    ],
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].vacationBalanceAfterHours, 4);
  assert.equal(
    results[1].vacationBalanceAfterHours,
    4,
    "4 previo + 4 acumulado - 4 usado = 4, la resta ocurre una sola vez",
  );
  // El movimiento de uso vive en employee_leave_ledger_entries
  // (vacation_used_hours en la fila de ese mes) y se conserva siempre —
  // reversed_at lo marca inactivo en vez de borrarlo cuando se reabre una
  // nómina, así que el movimiento nunca desaparece del ledger.
}

// --- Caso 12: mes sin información histórica completa ---
// LIMITACIÓN CONOCIDA: el sistema hoy no distingue "el empleado trabajó 0
// horas este mes" (dato completo) de "no hay ninguna nómina cargada para
// este mes" (dato ausente) — ambos casos producen un mes sin filas de
// ledger, tratado como 0 horas computables (nunca elegible). Esto es seguro
// en la dirección correcta (nunca inventa 130 horas ni acredita beneficio
// sin evidencia), pero NO implementa el reporte de excepciones ni el ajuste
// manual auditable que pide la sección 6 — eso requiere una tabla nueva de
// "meses con datos incompletos" que quedó fuera del alcance de "arreglo
// puntual" y debe planificarse aparte si se necesita.
{
  const results = replayLeaveHistory({
    hiringDate: "2024-01-01",
    months: [month({ year: 2024, month: 6 })], // sin datos: 0 horas, no se inventa acumulación
    sickBalanceCapHours: DEFAULT_SICK_BALANCE_CAP_HOURS,
  });
  assert.equal(results[0].qualifyingHours, 0);
  assert.equal(results[0].qualifies, false);
  assert.equal(results[0].vacationAccruedHours, 0);
  assert.equal(results[0].sickAccruedHours, 0);
}

// --- Caso 13: período que cruza dos meses se distribuye por fecha real, no todo al mes del Pay Day ---
{
  // Semana miércoles 2026-01-28 a martes 2026-02-03 (7 días exactos):
  // 4 días en enero (28,29,30,31), 3 días en febrero (1,2,3).
  const portions = splitHoursAcrossMonths("2026-01-28", {
    qualifyingHours: 40,
    vacationUsedHours: 7,
    sickUsedHours: 0,
  });
  assert.equal(portions.length, 2, "debe generar una porción por cada mes que toca la semana");
  const jan = portions.find((p) => p.month === 1)!;
  const feb = portions.find((p) => p.month === 2)!;
  assert.equal(jan.year, 2026);
  assert.equal(jan.fraction, 4 / 7);
  assert.equal(jan.qualifyingHours, 22.86, "40h * 4/7 redondeado a 2 decimales");
  assert.equal(feb.fraction, 3 / 7);
  assert.equal(feb.qualifyingHours, 17.14, "40h * 3/7 redondeado a 2 decimales");
  assert.equal(
    Math.round((jan.qualifyingHours + feb.qualifyingHours) * 100) / 100,
    40,
    "las porciones deben sumar el total original (dentro de redondeo)",
  );
  assert.equal(jan.vacationUsedHours, 4, "7h * 4/7 = 4");
  assert.equal(feb.vacationUsedHours, 3, "7h * 3/7 = 3");

  // Semana que no cruza mes: una sola porción, sin cambios.
  const single = splitHoursAcrossMonths("2026-03-02", {
    qualifyingHours: 40,
    vacationUsedHours: 0,
    sickUsedHours: 0,
  });
  assert.equal(single.length, 1);
  assert.equal(single[0].year, 2026);
  assert.equal(single[0].month, 3);
  assert.equal(single[0].fraction, 1);
  assert.equal(single[0].qualifyingHours, 40);
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
