import type {
  TresbeEmployee,
  TresbePayroll,
  TresbePayrollDailyEntry,
  TresbePayrollEntry,
} from "@/services/tresbe-payroll";
import type { TresbePayrollRule } from "@/lib/tresbe-payroll/calculations";

// Area-based breakdown for the payroll report (screen + PDF). Two separate
// data sources, on purpose:
//
// - Hours/tips come from tresbe_payroll_daily_entries.area_snapshot, which
//   is recorded per day. Someone who splits their week between Café con Ce
//   and Café con Ce Calle Cerra (it happens) is correctly split here.
// - Pay (system_pay/service_check_amount) only exists at the weekly level
//   in tresbe_payroll_entries -- there's no way to know which portion of a
//   split week's pay belongs to which area, so this groups by the
//   employee's current tresbe_employees.area instead. That's exactly right
//   for the vast majority who don't split areas in a week; for the rare
//   split case, Maria adjusts by hand outside Sinexia and will flag it --
//   this deliberately does not attempt to prorate that pay automatically.
//
// Café con Ce Calle Cerra is NOT a separate business from Tresbe's
// perspective -- its employees are Tresbe employees, and grouping by area
// is mutually exclusive (every entry lands in exactly one area bucket), so
// summing every area's numbers must always equal the payroll's own totals.
// If it doesn't, something's wrong -- see reconcileTresbeAreaReport.

export const CALLE_CERRA_AREA = "CAFE CON CE CERRA";

export type TresbeAreaHoursTips = { area: string; hours: number; tips: number };
export type TresbeAreaPay = { area: string; paidNoTip: number; total: number };

export function computeAreaHoursTips(
  dailyEntries: TresbePayrollDailyEntry[],
): TresbeAreaHoursTips[] {
  const byArea = new Map<string, TresbeAreaHoursTips>();
  for (const entry of dailyEntries) {
    const area = entry.area_snapshot;
    const current = byArea.get(area) ?? { area, hours: 0, tips: 0 };
    current.hours += Number(entry.hours);
    current.tips += Number(entry.tip_cafe_manual) + Number(entry.tip_proportional);
    byArea.set(area, current);
  }
  return [...byArea.values()]
    .map((row) => ({ ...row, hours: round2(row.hours), tips: round2(row.tips) }))
    .sort((a, b) => a.area.localeCompare(b.area));
}

// Grouping for the employee grid on the "Nóminas" tab. Reuses the exact
// same area lookup as computeAreaPay (current tresbe_employees.area), but
// pulls fixed-salary employees into their own group first -- their pay
// doesn't depend on hours and they rarely need to be touched, so mixing
// them into their area's group would bury them among employees who do
// need weekly attention.
export const FIXED_SALARY_GROUP_LABEL = "Salario semanal fijo";
const FIXED_SALARY_RULES: TresbePayrollRule[] = [
  "fixed_weekly_salary",
  "preset_40_weekly_salary",
];
const GRID_AREA_ORDER = ["BOH", "CAFE CON CE", CALLE_CERRA_AREA, "FOH", "Seguridad"];

export type TresbeEntryGroup = { label: string; entries: TresbePayrollEntry[] };

export function groupTresbeEntriesForGrid(
  entries: TresbePayrollEntry[],
  employees: Pick<TresbeEmployee, "id" | "area">[],
): TresbeEntryGroup[] {
  const areaByEmployeeId = new Map(employees.map((e) => [e.id, e.area]));
  const buckets = new Map<string, TresbePayrollEntry[]>();
  for (const entry of entries) {
    const label = FIXED_SALARY_RULES.includes(entry.payroll_rule_snapshot)
      ? FIXED_SALARY_GROUP_LABEL
      : (areaByEmployeeId.get(entry.employee_id) ?? "(sin área)");
    const list = buckets.get(label);
    if (list) list.push(entry);
    else buckets.set(label, [entry]);
  }
  const orderedLabels = [
    FIXED_SALARY_GROUP_LABEL,
    ...GRID_AREA_ORDER,
    ...[...buckets.keys()]
      .filter(
        (label) =>
          label !== FIXED_SALARY_GROUP_LABEL &&
          !GRID_AREA_ORDER.includes(label),
      )
      .sort(),
  ];
  return orderedLabels
    .filter((label) => buckets.has(label))
    .map((label) => ({ label, entries: buckets.get(label)! }));
}

export function computeAreaPay(
  entries: TresbePayrollEntry[],
  employees: Pick<TresbeEmployee, "id" | "area">[],
): TresbeAreaPay[] {
  const areaByEmployeeId = new Map(employees.map((e) => [e.id, e.area]));
  const byArea = new Map<string, TresbeAreaPay>();
  for (const entry of entries) {
    const area = areaByEmployeeId.get(entry.employee_id) ?? "(sin área)";
    const current = byArea.get(area) ?? { area, paidNoTip: 0, total: 0 };
    current.paidNoTip += Number(entry.system_pay) + Number(entry.service_check_amount);
    current.total += Number(entry.employee_total);
    byArea.set(area, current);
  }
  return [...byArea.values()]
    .map((row) => ({
      ...row,
      paidNoTip: round2(row.paidNoTip),
      total: round2(row.total),
    }))
    .sort((a, b) => a.area.localeCompare(b.area));
}

export type TresbeReconciliation = { ok: boolean; warnings: string[] };

const RECONCILE_TOLERANCE = 0.02;

export function reconcileTresbeAreaReport(
  payroll: Pick<
    TresbePayroll,
    "total_system_pay" | "total_service_checks" | "total_tips"
  >,
  areaPay: TresbeAreaPay[],
  areaHoursTips: TresbeAreaHoursTips[],
): TresbeReconciliation {
  const warnings: string[] = [];

  const sumPaidNoTip = round2(areaPay.reduce((sum, a) => sum + a.paidNoTip, 0));
  const expectedPaidNoTip = round2(
    Number(payroll.total_system_pay) + Number(payroll.total_service_checks),
  );
  if (Math.abs(sumPaidNoTip - expectedPaidNoTip) > RECONCILE_TOLERANCE) {
    warnings.push(
      `Horas pagadas por área suman ${moneyStr(sumPaidNoTip)}, pero Sistema + Servicios de la nómina da ${moneyStr(expectedPaidNoTip)}. Probablemente falta apretar "Recalcular".`,
    );
  }

  const sumTips = round2(areaHoursTips.reduce((sum, a) => sum + a.tips, 0));
  const expectedTips = round2(Number(payroll.total_tips));
  if (Math.abs(sumTips - expectedTips) > RECONCILE_TOLERANCE) {
    warnings.push(
      `Las propinas de Carga Diaria por área suman ${moneyStr(sumTips)}, pero el total de propinas de la nómina da ${moneyStr(expectedTips)}.`,
    );
  }

  return { ok: warnings.length === 0, warnings };
}

export type TresbeAreaPercentages = {
  nonCalleCerraPaidNoTip: number;
  calleCerraPaidNoTip: number;
  allAreasPaidNoTip: number;
  nominaTresbePct: number | null;
  incidencia: { area: string; pct: number | null }[];
  calleCerraNominaPct: number | null;
  worstCasePct: number | null;
};

export function computeTresbeAreaPercentages(
  payroll: Pick<TresbePayroll, "sales_tresbe" | "sales_cafe_con_ce_calle_cerra">,
  areaPay: TresbeAreaPay[],
): TresbeAreaPercentages {
  const salesTresbe = Number(payroll.sales_tresbe);
  const salesCalleCerra = Number(payroll.sales_cafe_con_ce_calle_cerra);

  const nonCalleCerra = areaPay.filter((a) => a.area !== CALLE_CERRA_AREA);
  const calleCerra = areaPay.find((a) => a.area === CALLE_CERRA_AREA) ?? null;
  const nonCalleCerraPaidNoTip = round2(
    nonCalleCerra.reduce((sum, a) => sum + a.paidNoTip, 0),
  );
  const calleCerraPaidNoTip = calleCerra ? calleCerra.paidNoTip : 0;
  const allAreasPaidNoTip = round2(nonCalleCerraPaidNoTip + calleCerraPaidNoTip);

  return {
    nonCalleCerraPaidNoTip,
    calleCerraPaidNoTip,
    allAreasPaidNoTip,
    nominaTresbePct:
      salesTresbe > 0 ? percentOf(nonCalleCerraPaidNoTip, salesTresbe) : null,
    incidencia: areaPay.map((a) => ({
      area: a.area,
      pct:
        a.area === CALLE_CERRA_AREA
          ? salesCalleCerra > 0
            ? percentOf(a.paidNoTip, salesCalleCerra)
            : null
          : salesTresbe > 0
            ? percentOf(a.paidNoTip, salesTresbe)
            : null,
    })),
    calleCerraNominaPct:
      salesCalleCerra > 0 && calleCerra
        ? percentOf(calleCerraPaidNoTip, salesCalleCerra)
        : null,
    worstCasePct:
      salesTresbe > 0 ? percentOf(allAreasPaidNoTip, salesTresbe) : null,
  };
}

// NOTE: this deliberately sums service_check_amount alone, not
// "+ fixed_service_amount" as literally requested. fixed_service_amount is
// the override INPUT (what an admin types in to force a check amount);
// service_check_amount is the resulting real dollar amount already paid
// via that check (calculate_tresbe_payroll_entry copies the override into
// it). Adding both would double-count every entry with an active
// override -- e.g. Fernando Almonte's $280 reimbursement would show as
// $560. Flagged for Maria to confirm; using the one number that matches
// real money and the "Servicios" column shown everywhere else.
export function computeServiceChecksTotal(entries: TresbePayrollEntry[]) {
  return round2(
    entries.reduce((sum, e) => sum + Number(e.service_check_amount), 0),
  );
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentOf(part: number, whole: number) {
  return whole > 0 ? round2((part / whole) * 100) : 0;
}

function moneyStr(value: number) {
  return `$${value.toFixed(2)}`;
}
