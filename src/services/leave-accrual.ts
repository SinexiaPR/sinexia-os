import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SICK_BALANCE_CAP_HOURS,
  monthsOfService,
  monthQualifies,
  qualifyingHoursFromCategories,
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
  currentMonthHours: number;
  currentMonthQualifies: boolean;
  vacationBalanceHours: number;
  sickBalanceHours: number;
  lastPayrollProcessedAt: string | null;
};

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

  return employees.map((employee) => {
    const balance = balanceByEmployee.get(employee.id);
    const currentMonthHours = currentMonthByEmployee.get(employee.id) ?? 0;
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

  return employees.map((employee) => {
    const balance = balanceByEmployee.get(employee.id);
    const currentMonthHours = currentMonthByEmployee.get(employee.id) ?? 0;
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
