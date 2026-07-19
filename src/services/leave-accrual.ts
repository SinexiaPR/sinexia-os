import { createClient } from "@/lib/supabase/server";
import {
  currentTenureSnapshot,
  DEFAULT_SICK_BALANCE_CAP_HOURS,
  monthsOfService,
  monthQualifies,
  qualifyingHoursFromCategories,
  type TenureTier,
  yearsOfServiceFromMonths,
} from "@/lib/leave-accrual/calculations";
import { resolveSibaritaCompany } from "@/services/payroll";
import { resolveTresbeCompany } from "@/services/tresbe-payroll";

export type LeaveAccrualReportRow = {
  sourceSystem: "sibarita" | "tresbe";
  employeeId: string;
  employeeName: string;
  companyName: string;
  hiringDate: string | null;
  yearsOfService: number | null;
  currentTier: TenureTier | null;
  monthlyVacationRateHours: number | null;
  nextTierChangeDate: string | null;
  currentMonthHours: number;
  currentMonthQualifies: boolean;
  vacationBalanceHours: number;
  sickBalanceHours: number;
  lastPayrollProcessedAt: string | null;
};

/** Today as a plain YYYY-MM-DD date string (local server date, no time component). */
function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getLeaveAccrualSettings(
  companyId: string,
): Promise<{ sickBalanceCapHours: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_accrual_settings")
    .select("sick_balance_cap_hours")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return {
    sickBalanceCapHours: data
      ? Number(data.sick_balance_cap_hours)
      : DEFAULT_SICK_BALANCE_CAP_HOURS,
  };
}

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function monthBounds(year: number, month: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const start = `${year}-${pad(month)}-01`;
  const end =
    month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { start, end };
}

async function getSibaritaReportRows(): Promise<LeaveAccrualReportRow[]> {
  const supabase = await createClient();
  const company = await resolveSibaritaCompany();
  if (!company) return [];

  const { data: employees, error: employeesError } = await supabase
    .from("payroll_employees")
    .select("id,first_name,last_name,hiring_date")
    .eq("company_id", company.id)
    .eq("worker_classification", "w2");
  if (employeesError) throw employeesError;
  if (!employees?.length) return [];

  const employeeIds = employees.map((employee) => employee.id);
  const { data: balances, error: balancesError } = await supabase
    .from("employee_leave_balances")
    .select(
      "sibarita_employee_id,vacation_balance_hours,sick_balance_hours,last_payroll_processed_at",
    )
    .eq("source_system", "sibarita")
    .in("sibarita_employee_id", employeeIds);
  if (balancesError) throw balancesError;
  const balanceByEmployee = new Map(
    (balances ?? []).map((balance) => [balance.sibarita_employee_id, balance]),
  );

  const { year, month } = currentYearMonth();
  const { start, end } = monthBounds(year, month);
  const { data: payrolls, error: payrollsError } = await supabase
    .from("weekly_payrolls")
    .select("id")
    .eq("company_id", company.id)
    .gte("week_end", start)
    .lt("week_end", end);
  if (payrollsError) throw payrollsError;
  const payrollIds = (payrolls ?? []).map((payroll) => payroll.id);

  const currentMonthByEmployee = new Map<string, number>();
  if (payrollIds.length) {
    const { data: entries, error: entriesError } = await supabase
      .from("weekly_payroll_entries")
      .select(
        "employee_id,regular_hours,training_hours,vacation_paid_hours,sick_paid_hours,holiday_paid_hours,jury_duty_hours,bereavement_hours",
      )
      .in("payroll_id", payrollIds);
    if (entriesError) throw entriesError;
    for (const entry of entries ?? []) {
      const hours = qualifyingHoursFromCategories({
        regularHours: Number(entry.regular_hours),
        trainingHours: Number(entry.training_hours),
        vacationPaidHours: Number(entry.vacation_paid_hours),
        sickPaidHours: Number(entry.sick_paid_hours),
        holidayPaidHours: Number(entry.holiday_paid_hours),
        juryDutyHours: Number(entry.jury_duty_hours),
        bereavementHours: Number(entry.bereavement_hours),
      });
      currentMonthByEmployee.set(
        entry.employee_id,
        (currentMonthByEmployee.get(entry.employee_id) ?? 0) + hours,
      );
    }
  }

  const today = todayISODate();
  return employees.map((employee) => {
    const balance = balanceByEmployee.get(employee.id);
    const currentMonthHours = currentMonthByEmployee.get(employee.id) ?? 0;
    const tenure = employee.hiring_date
      ? currentTenureSnapshot(employee.hiring_date, today)
      : null;
    return {
      sourceSystem: "sibarita" as const,
      employeeId: employee.id,
      employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
      companyName: company.name,
      hiringDate: employee.hiring_date,
      yearsOfService: employee.hiring_date
        ? yearsOfServiceFromMonths(
            monthsOfService(employee.hiring_date, year, month),
          )
        : null,
      currentTier: tenure?.tier ?? null,
      monthlyVacationRateHours: tenure?.monthlyVacationRateHours ?? null,
      nextTierChangeDate: tenure?.nextTierChangeDate ?? null,
      currentMonthHours,
      currentMonthQualifies: monthQualifies(currentMonthHours),
      vacationBalanceHours: balance ? Number(balance.vacation_balance_hours) : 0,
      sickBalanceHours: balance ? Number(balance.sick_balance_hours) : 0,
      lastPayrollProcessedAt: balance?.last_payroll_processed_at ?? null,
    };
  });
}

async function getTresbeReportRows(): Promise<LeaveAccrualReportRow[]> {
  const supabase = await createClient();
  const company = await resolveTresbeCompany();
  if (!company) return [];

  const { data: employees, error: employeesError } = await supabase
    .from("tresbe_employees")
    .select("id,display_name,hiring_date")
    .eq("company_id", company.id)
    .eq("worker_classification", "w2");
  if (employeesError) throw employeesError;
  if (!employees?.length) return [];

  const employeeIds = employees.map((employee) => employee.id);
  const { data: balances, error: balancesError } = await supabase
    .from("employee_leave_balances")
    .select(
      "tresbe_employee_id,vacation_balance_hours,sick_balance_hours,last_payroll_processed_at",
    )
    .eq("source_system", "tresbe")
    .in("tresbe_employee_id", employeeIds);
  if (balancesError) throw balancesError;
  const balanceByEmployee = new Map(
    (balances ?? []).map((balance) => [balance.tresbe_employee_id, balance]),
  );

  const { year, month } = currentYearMonth();
  const { start, end } = monthBounds(year, month);
  const { data: payrolls, error: payrollsError } = await supabase
    .from("tresbe_payrolls")
    .select("id")
    .eq("company_id", company.id)
    .gte("week_end", start)
    .lt("week_end", end);
  if (payrollsError) throw payrollsError;
  const payrollIds = (payrolls ?? []).map((payroll) => payroll.id);

  const currentMonthByEmployee = new Map<string, number>();
  if (payrollIds.length) {
    const { data: entries, error: entriesError } = await supabase
      .from("tresbe_payroll_entries")
      .select(
        "employee_id,system_hours,vacation_paid_hours,sick_paid_hours,holiday_paid_hours,jury_duty_hours,bereavement_hours",
      )
      .in("payroll_id", payrollIds);
    if (entriesError) throw entriesError;
    for (const entry of entries ?? []) {
      const hours = qualifyingHoursFromCategories({
        regularHours: Number(entry.system_hours),
        trainingHours: 0,
        vacationPaidHours: Number(entry.vacation_paid_hours),
        sickPaidHours: Number(entry.sick_paid_hours),
        holidayPaidHours: Number(entry.holiday_paid_hours),
        juryDutyHours: Number(entry.jury_duty_hours),
        bereavementHours: Number(entry.bereavement_hours),
      });
      currentMonthByEmployee.set(
        entry.employee_id,
        (currentMonthByEmployee.get(entry.employee_id) ?? 0) + hours,
      );
    }
  }

  const today = todayISODate();
  return employees.map((employee) => {
    const balance = balanceByEmployee.get(employee.id);
    const currentMonthHours = currentMonthByEmployee.get(employee.id) ?? 0;
    const tenure = employee.hiring_date
      ? currentTenureSnapshot(employee.hiring_date, today)
      : null;
    return {
      sourceSystem: "tresbe" as const,
      employeeId: employee.id,
      employeeName: employee.display_name,
      companyName: company.name,
      hiringDate: employee.hiring_date,
      yearsOfService: employee.hiring_date
        ? yearsOfServiceFromMonths(
            monthsOfService(employee.hiring_date, year, month),
          )
        : null,
      currentTier: tenure?.tier ?? null,
      monthlyVacationRateHours: tenure?.monthlyVacationRateHours ?? null,
      nextTierChangeDate: tenure?.nextTierChangeDate ?? null,
      currentMonthHours,
      currentMonthQualifies: monthQualifies(currentMonthHours),
      vacationBalanceHours: balance ? Number(balance.vacation_balance_hours) : 0,
      sickBalanceHours: balance ? Number(balance.sick_balance_hours) : 0,
      lastPayrollProcessedAt: balance?.last_payroll_processed_at ?? null,
    };
  });
}

export async function getLeaveAccrualReport(): Promise<LeaveAccrualReportRow[]> {
  const [sibarita, tresbe] = await Promise.all([
    getSibaritaReportRows(),
    getTresbeReportRows(),
  ]);
  return [...sibarita, ...tresbe].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );
}

export type LeaveAccrualMonthlyHistoryRow = {
  periodYear: number;
  periodMonth: number;
  qualifyingHours: number;
  qualifies: boolean;
  yearsOfService: number;
  tenureTier: TenureTier;
  vacationAccruedHours: number;
  sickAccruedHours: number;
  vacationUsedHours: number;
  sickUsedHours: number;
  vacationBalanceAfterHours: number;
  sickBalanceAfterHours: number;
  sickCapHoursApplied: number;
  calculationVersion: number;
  hiringDateUsed: string | null;
  sourcePayrollIds: string[];
};

export type LeaveAccrualEmployeeDetail = {
  sourceSystem: "sibarita" | "tresbe";
  employeeId: string;
  employeeName: string;
  companyName: string;
  hiringDate: string | null;
  workerClassification: string;
  tenure: {
    monthsOfService: number;
    yearsOfService: number;
    tier: TenureTier;
    monthlyVacationRateHours: number;
    nextTierChangeDate: string | null;
  } | null;
  currentMonthHours: number;
  currentMonthQualifies: boolean;
  vacationBalanceHours: number;
  sickBalanceHours: number;
  vacationAccruedLifetimeHours: number;
  sickAccruedLifetimeHours: number;
  vacationUsedLifetimeHours: number;
  sickUsedLifetimeHours: number;
  lastPayrollProcessedAt: string | null;
  openingBalance: {
    vacationHours: number;
    sickHours: number;
    asOfYear: number;
    asOfMonth: number;
    note: string | null;
  } | null;
  monthlyHistory: LeaveAccrualMonthlyHistoryRow[];
};

/**
 * Full per-employee detail for the admin drill-down view: live tenure
 * status (exact-date tier + next anniversary), current balances, and the
 * complete monthly history with its audit trail (which payroll(s) fed each
 * month, which hiring date was used, how many times it's been
 * recalculated). Scoped to the employee's own company — an id that belongs
 * to the other source system's company (or doesn't exist) returns null.
 */
export async function getEmployeeLeaveDetail(
  sourceSystem: "sibarita" | "tresbe",
  employeeId: string,
): Promise<LeaveAccrualEmployeeDetail | null> {
  const supabase = await createClient();
  const company =
    sourceSystem === "sibarita"
      ? await resolveSibaritaCompany()
      : await resolveTresbeCompany();
  if (!company) return null;

  const employeeColumn = sourceSystem === "sibarita" ? "sibarita_employee_id" : "tresbe_employee_id";

  let employeeName: string;
  let hiringDate: string | null;
  let workerClassification: string;
  if (sourceSystem === "sibarita") {
    const { data: employee, error } = await supabase
      .from("payroll_employees")
      .select("first_name,last_name,hiring_date,worker_classification")
      .eq("id", employeeId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (error) throw error;
    if (!employee) return null;
    employeeName = `${employee.first_name} ${employee.last_name}`.trim();
    hiringDate = employee.hiring_date;
    workerClassification = employee.worker_classification;
  } else {
    const { data: employee, error } = await supabase
      .from("tresbe_employees")
      .select("display_name,hiring_date,worker_classification")
      .eq("id", employeeId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (error) throw error;
    if (!employee) return null;
    employeeName = employee.display_name;
    hiringDate = employee.hiring_date;
    workerClassification = employee.worker_classification;
  }

  const { year, month } = currentYearMonth();
  const { start, end } = monthBounds(year, month);

  const [balanceResult, openingResult, historyResult, currentMonthHours] = await Promise.all([
    supabase
      .from("employee_leave_balances")
      .select(
        "vacation_balance_hours,sick_balance_hours,vacation_accrued_lifetime_hours,sick_accrued_lifetime_hours,vacation_used_lifetime_hours,sick_used_lifetime_hours,last_payroll_processed_at",
      )
      .eq("source_system", sourceSystem)
      .eq(employeeColumn, employeeId)
      .maybeSingle(),
    supabase
      .from("employee_leave_opening_balances")
      .select("opening_vacation_hours,opening_sick_hours,as_of_year,as_of_month,note")
      .eq("source_system", sourceSystem)
      .eq(employeeColumn, employeeId)
      .maybeSingle(),
    supabase
      .from("employee_leave_history")
      .select(
        "period_year,period_month,qualifying_hours,qualifies,years_of_service,tenure_tier,vacation_accrued_hours,sick_accrued_hours,vacation_used_hours,sick_used_hours,vacation_balance_after_hours,sick_balance_after_hours,sick_cap_hours_applied,calculation_version,hiring_date_used,source_payroll_ids",
      )
      .eq("source_system", sourceSystem)
      .eq(employeeColumn, employeeId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false }),
    getCurrentMonthQualifyingHours(supabase, sourceSystem, employeeId, start, end),
  ]);
  if (balanceResult.error) throw balanceResult.error;
  if (openingResult.error) throw openingResult.error;
  if (historyResult.error) throw historyResult.error;

  const balance = balanceResult.data;
  const opening = openingResult.data;

  return {
    sourceSystem,
    employeeId,
    employeeName,
    companyName: company.name,
    hiringDate,
    workerClassification,
    tenure: hiringDate ? currentTenureSnapshot(hiringDate, todayISODate()) : null,
    currentMonthHours,
    currentMonthQualifies: monthQualifies(currentMonthHours),
    vacationBalanceHours: balance ? Number(balance.vacation_balance_hours) : 0,
    sickBalanceHours: balance ? Number(balance.sick_balance_hours) : 0,
    vacationAccruedLifetimeHours: balance ? Number(balance.vacation_accrued_lifetime_hours) : 0,
    sickAccruedLifetimeHours: balance ? Number(balance.sick_accrued_lifetime_hours) : 0,
    vacationUsedLifetimeHours: balance ? Number(balance.vacation_used_lifetime_hours) : 0,
    sickUsedLifetimeHours: balance ? Number(balance.sick_used_lifetime_hours) : 0,
    lastPayrollProcessedAt: balance?.last_payroll_processed_at ?? null,
    openingBalance: opening
      ? {
          vacationHours: Number(opening.opening_vacation_hours),
          sickHours: Number(opening.opening_sick_hours),
          asOfYear: opening.as_of_year,
          asOfMonth: opening.as_of_month,
          note: opening.note,
        }
      : null,
    monthlyHistory: (historyResult.data ?? []).map((row) => ({
      periodYear: row.period_year,
      periodMonth: row.period_month,
      qualifyingHours: Number(row.qualifying_hours),
      qualifies: row.qualifies,
      yearsOfService: Number(row.years_of_service),
      tenureTier: row.tenure_tier as TenureTier,
      vacationAccruedHours: Number(row.vacation_accrued_hours),
      sickAccruedHours: Number(row.sick_accrued_hours),
      vacationUsedHours: Number(row.vacation_used_hours),
      sickUsedHours: Number(row.sick_used_hours),
      vacationBalanceAfterHours: Number(row.vacation_balance_after_hours),
      sickBalanceAfterHours: Number(row.sick_balance_after_hours),
      sickCapHoursApplied: Number(row.sick_cap_hours_applied),
      calculationVersion: row.calculation_version,
      hiringDateUsed: row.hiring_date_used,
      sourcePayrollIds: row.source_payroll_ids ?? [],
    })),
  };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** This month's qualifying hours for a single employee (used by the detail drill-down). */
async function getCurrentMonthQualifyingHours(
  supabase: SupabaseClient,
  sourceSystem: "sibarita" | "tresbe",
  employeeId: string,
  monthStart: string,
  monthEnd: string,
): Promise<number> {
  if (sourceSystem === "sibarita") {
    const { data: payrolls, error: payrollsError } = await supabase
      .from("weekly_payrolls")
      .select("id")
      .gte("week_end", monthStart)
      .lt("week_end", monthEnd);
    if (payrollsError) throw payrollsError;
    const payrollIds = (payrolls ?? []).map((payroll) => payroll.id);
    if (!payrollIds.length) return 0;

    const { data: entries, error: entriesError } = await supabase
      .from("weekly_payroll_entries")
      .select(
        "regular_hours,training_hours,vacation_paid_hours,sick_paid_hours,holiday_paid_hours,jury_duty_hours,bereavement_hours",
      )
      .eq("employee_id", employeeId)
      .in("payroll_id", payrollIds);
    if (entriesError) throw entriesError;
    return (entries ?? []).reduce(
      (sum, entry) =>
        sum +
        qualifyingHoursFromCategories({
          regularHours: Number(entry.regular_hours),
          trainingHours: Number(entry.training_hours),
          vacationPaidHours: Number(entry.vacation_paid_hours),
          sickPaidHours: Number(entry.sick_paid_hours),
          holidayPaidHours: Number(entry.holiday_paid_hours),
          juryDutyHours: Number(entry.jury_duty_hours),
          bereavementHours: Number(entry.bereavement_hours),
        }),
      0,
    );
  }

  const { data: payrolls, error: payrollsError } = await supabase
    .from("tresbe_payrolls")
    .select("id")
    .gte("week_end", monthStart)
    .lt("week_end", monthEnd);
  if (payrollsError) throw payrollsError;
  const payrollIds = (payrolls ?? []).map((payroll) => payroll.id);
  if (!payrollIds.length) return 0;

  const { data: entries, error: entriesError } = await supabase
    .from("tresbe_payroll_entries")
    .select(
      "system_hours,vacation_paid_hours,sick_paid_hours,holiday_paid_hours,jury_duty_hours,bereavement_hours",
    )
    .eq("employee_id", employeeId)
    .in("payroll_id", payrollIds);
  if (entriesError) throw entriesError;
  return (entries ?? []).reduce(
    (sum, entry) =>
      sum +
      qualifyingHoursFromCategories({
        regularHours: Number(entry.system_hours),
        trainingHours: 0,
        vacationPaidHours: Number(entry.vacation_paid_hours),
        sickPaidHours: Number(entry.sick_paid_hours),
        holidayPaidHours: Number(entry.holiday_paid_hours),
        juryDutyHours: Number(entry.jury_duty_hours),
        bereavementHours: Number(entry.bereavement_hours),
      }),
    0,
  );
}
