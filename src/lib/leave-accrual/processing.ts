import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SICK_BALANCE_CAP_HOURS,
  enumerateMonths,
  payMonthFor,
  qualifyingHoursFromCategories,
  replayLeaveHistory,
  type MonthLedgerInput,
} from "@/lib/leave-accrual/calculations";

type SourceSystem = "sibarita" | "tresbe";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function employeeColumnFor(sourceSystem: SourceSystem) {
  return sourceSystem === "sibarita" ? "sibarita_employee_id" : "tresbe_employee_id";
}

function entryColumnFor(sourceSystem: SourceSystem) {
  return sourceSystem === "sibarita" ? "sibarita_entry_id" : "tresbe_entry_id";
}

async function getSickBalanceCapHours(
  supabase: SupabaseClient,
  companyId: string,
): Promise<number> {
  const { data } = await supabase
    .from("leave_accrual_settings")
    .select("sick_balance_cap_hours")
    .eq("company_id", companyId)
    .maybeSingle();
  return data ? Number(data.sick_balance_cap_hours) : DEFAULT_SICK_BALANCE_CAP_HOURS;
}

async function upsertLedgerRow(
  supabase: SupabaseClient,
  sourceSystem: SourceSystem,
  row: {
    companyId: string;
    employeeId: string;
    entryId: string;
    periodYear: number;
    periodMonth: number;
    qualifyingHours: number;
    vacationUsedHours: number;
    sickUsedHours: number;
  },
) {
  const payload = {
    company_id: row.companyId,
    source_system: sourceSystem,
    [employeeColumnFor(sourceSystem)]: row.employeeId,
    [entryColumnFor(sourceSystem)]: row.entryId,
    period_year: row.periodYear,
    period_month: row.periodMonth,
    qualifying_hours: row.qualifyingHours,
    vacation_used_hours: row.vacationUsedHours,
    sick_used_hours: row.sickUsedHours,
    reversed_at: null,
    processed_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("employee_leave_ledger_entries")
    .upsert(payload, { onConflict: entryColumnFor(sourceSystem) });
  if (error) throw error;
}

/**
 * Fully recomputes and persists one employee's leave balance/history from
 * their active (non-reversed) ledger rows. Derived, not incremental: safe
 * to call as many times as needed, always converges to the same result for
 * the same ledger state (see replayLeaveHistory's doc comment).
 */
async function replayAndPersistBalance(
  supabase: SupabaseClient,
  sourceSystem: SourceSystem,
  companyId: string,
  employeeId: string,
  hiringDate: string,
) {
  const employeeColumn = employeeColumnFor(sourceSystem);

  const [ledgerResult, sickBalanceCapHours] = await Promise.all([
    supabase
      .from("employee_leave_ledger_entries")
      .select("period_year,period_month,qualifying_hours,vacation_used_hours,sick_used_hours")
      .eq("source_system", sourceSystem)
      .eq(employeeColumn, employeeId)
      .is("reversed_at", null),
    getSickBalanceCapHours(supabase, companyId),
  ]);
  if (ledgerResult.error) throw ledgerResult.error;

  const byMonth = new Map<string, MonthLedgerInput>();
  for (const row of ledgerResult.data ?? []) {
    const key = `${row.period_year}-${row.period_month}`;
    const existing = byMonth.get(key) ?? {
      year: row.period_year,
      month: row.period_month,
      qualifyingHours: 0,
      vacationUsedHours: 0,
      sickUsedHours: 0,
    };
    existing.qualifyingHours += Number(row.qualifying_hours);
    existing.vacationUsedHours += Number(row.vacation_used_hours);
    existing.sickUsedHours += Number(row.sick_used_hours);
    byMonth.set(key, existing);
  }

  if (byMonth.size === 0) {
    // Every payroll that ever touched this employee has since been
    // reopened/reversed with nothing reprocessed yet — nothing to show.
    await supabase
      .from("employee_leave_balances")
      .delete()
      .eq("source_system", sourceSystem)
      .eq(employeeColumn, employeeId);
    return;
  }

  const activeMonths = [...byMonth.keys()]
    .map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month };
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  const last = activeMonths[activeMonths.length - 1];
  const [hiringYear, hiringMonth] = hiringDate.split("-").map(Number);

  const months: MonthLedgerInput[] = enumerateMonths(
    hiringYear,
    hiringMonth,
    last.year,
    last.month,
  ).map(({ year, month }) => {
    const key = `${year}-${month}`;
    return (
      byMonth.get(key) ?? {
        year,
        month,
        qualifyingHours: 0,
        vacationUsedHours: 0,
        sickUsedHours: 0,
      }
    );
  });

  const results = replayLeaveHistory({ hiringDate, months, sickBalanceCapHours });
  const final = results[results.length - 1];

  const historyRows = results.map((result) => ({
    company_id: companyId,
    source_system: sourceSystem,
    [employeeColumn]: employeeId,
    period_year: result.year,
    period_month: result.month,
    qualifying_hours: result.qualifyingHours,
    qualifies: result.qualifies,
    years_of_service: result.yearsOfService,
    tenure_tier: result.tenureTier,
    vacation_accrued_hours: result.vacationAccruedHours,
    sick_accrued_hours: result.sickAccruedHours,
    vacation_used_hours: result.vacationUsedHours,
    sick_used_hours: result.sickUsedHours,
    vacation_balance_after_hours: result.vacationBalanceAfterHours,
    sick_balance_after_hours: result.sickBalanceAfterHours,
    sick_cap_hours_applied: result.sickCapHoursApplied,
  }));
  const historyOnConflict =
    sourceSystem === "sibarita"
      ? "sibarita_employee_id,period_year,period_month"
      : "tresbe_employee_id,period_year,period_month";
  const { error: historyError } = await supabase
    .from("employee_leave_history")
    .upsert(historyRows, { onConflict: historyOnConflict });
  if (historyError) throw historyError;

  const lifetime = results.reduce(
    (sum, result) => ({
      vacationAccrued: sum.vacationAccrued + result.vacationAccruedHours,
      sickAccrued: sum.sickAccrued + result.sickAccruedHours,
      vacationUsed: sum.vacationUsed + result.vacationUsedHours,
      sickUsed: sum.sickUsed + result.sickUsedHours,
    }),
    { vacationAccrued: 0, sickAccrued: 0, vacationUsed: 0, sickUsed: 0 },
  );

  const { error: balanceError } = await supabase
    .from("employee_leave_balances")
    .upsert(
      {
        company_id: companyId,
        source_system: sourceSystem,
        [employeeColumn]: employeeId,
        vacation_balance_hours: final.vacationBalanceAfterHours,
        sick_balance_hours: final.sickBalanceAfterHours,
        vacation_accrued_lifetime_hours: lifetime.vacationAccrued,
        sick_accrued_lifetime_hours: lifetime.sickAccrued,
        vacation_used_lifetime_hours: lifetime.vacationUsed,
        sick_used_lifetime_hours: lifetime.sickUsed,
        last_replayed_year: final.year,
        last_replayed_month: final.month,
        last_payroll_processed_at: new Date().toISOString(),
      },
      { onConflict: employeeColumn },
    );
  if (balanceError) throw balanceError;
}

export async function syncLeaveAccrualForSibaritaPayroll(payrollId: string) {
  const supabase = await createClient();
  const { data: payroll, error: payrollError } = await supabase
    .from("weekly_payrolls")
    .select("id,company_id,week_end")
    .eq("id", payrollId)
    .maybeSingle();
  if (payrollError) throw payrollError;
  if (!payroll) return;

  const { data: entries, error: entriesError } = await supabase
    .from("weekly_payroll_entries")
    .select(
      "id,employee_id,regular_hours,training_hours,vacation_paid_hours,sick_paid_hours,holiday_paid_hours,jury_duty_hours,bereavement_hours",
    )
    .eq("payroll_id", payrollId);
  if (entriesError) throw entriesError;
  if (!entries?.length) return;

  const employeeIds = [...new Set(entries.map((entry) => entry.employee_id))];
  const { data: employees, error: employeesError } = await supabase
    .from("payroll_employees")
    .select("id,worker_classification,hiring_date")
    .in("id", employeeIds);
  if (employeesError) throw employeesError;
  const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]));

  const { year, month } = payMonthFor(payroll.week_end);
  const touchedEmployeeIds = new Set<string>();

  for (const entry of entries) {
    const employee = employeeById.get(entry.employee_id);
    if (!employee || employee.worker_classification !== "w2" || !employee.hiring_date) continue;

    const qualifyingHours = qualifyingHoursFromCategories({
      regularHours: Number(entry.regular_hours),
      trainingHours: Number(entry.training_hours),
      vacationPaidHours: Number(entry.vacation_paid_hours),
      sickPaidHours: Number(entry.sick_paid_hours),
      holidayPaidHours: Number(entry.holiday_paid_hours),
      juryDutyHours: Number(entry.jury_duty_hours),
      bereavementHours: Number(entry.bereavement_hours),
    });
    await upsertLedgerRow(supabase, "sibarita", {
      companyId: payroll.company_id,
      employeeId: employee.id,
      entryId: entry.id,
      periodYear: year,
      periodMonth: month,
      qualifyingHours,
      vacationUsedHours: Number(entry.vacation_paid_hours),
      sickUsedHours: Number(entry.sick_paid_hours),
    });
    touchedEmployeeIds.add(employee.id);
  }

  for (const employeeId of touchedEmployeeIds) {
    const employee = employeeById.get(employeeId)!;
    await replayAndPersistBalance(
      supabase,
      "sibarita",
      payroll.company_id,
      employeeId,
      employee.hiring_date,
    );
  }
}

export async function reverseLeaveAccrualForSibaritaPayroll(payrollId: string) {
  const supabase = await createClient();
  const { data: payroll, error: payrollError } = await supabase
    .from("weekly_payrolls")
    .select("id,company_id")
    .eq("id", payrollId)
    .maybeSingle();
  if (payrollError) throw payrollError;
  if (!payroll) return;

  const { data: entries, error: entriesError } = await supabase
    .from("weekly_payroll_entries")
    .select("id")
    .eq("payroll_id", payrollId);
  if (entriesError) throw entriesError;
  const entryIds = (entries ?? []).map((entry) => entry.id);
  if (!entryIds.length) return;

  const { data: reversedRows, error: reverseError } = await supabase
    .from("employee_leave_ledger_entries")
    .update({ reversed_at: new Date().toISOString() })
    .in("sibarita_entry_id", entryIds)
    .is("reversed_at", null)
    .select("sibarita_employee_id");
  if (reverseError) throw reverseError;

  const employeeIds = [
    ...new Set((reversedRows ?? []).map((row) => row.sibarita_employee_id as string)),
  ];
  if (!employeeIds.length) return;

  const { data: employees, error: employeesError } = await supabase
    .from("payroll_employees")
    .select("id,hiring_date")
    .in("id", employeeIds);
  if (employeesError) throw employeesError;

  for (const employee of employees ?? []) {
    if (!employee.hiring_date) continue;
    await replayAndPersistBalance(
      supabase,
      "sibarita",
      payroll.company_id,
      employee.id,
      employee.hiring_date,
    );
  }
}

export async function syncLeaveAccrualForTresbePayroll(payrollId: string) {
  const supabase = await createClient();
  const { data: payroll, error: payrollError } = await supabase
    .from("tresbe_payrolls")
    .select("id,company_id,week_end")
    .eq("id", payrollId)
    .maybeSingle();
  if (payrollError) throw payrollError;
  if (!payroll) return;

  const { data: entries, error: entriesError } = await supabase
    .from("tresbe_payroll_entries")
    .select(
      "id,employee_id,system_hours,vacation_paid_hours,sick_paid_hours,holiday_paid_hours,jury_duty_hours,bereavement_hours",
    )
    .eq("payroll_id", payrollId);
  if (entriesError) throw entriesError;
  if (!entries?.length) return;

  const employeeIds = [...new Set(entries.map((entry) => entry.employee_id))];
  const { data: employees, error: employeesError } = await supabase
    .from("tresbe_employees")
    .select("id,worker_classification,hiring_date")
    .in("id", employeeIds);
  if (employeesError) throw employeesError;
  const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]));

  const { year, month } = payMonthFor(payroll.week_end);
  const touchedEmployeeIds = new Set<string>();

  for (const entry of entries) {
    const employee = employeeById.get(entry.employee_id);
    if (!employee || employee.worker_classification !== "w2" || !employee.hiring_date) continue;

    // Only system_hours count toward qualification for Tresbe (confirmed
    // with the business owner): an employee paid via 'full_services' always
    // has system_hours = 0 and so never qualifies, even if classified w2.
    const qualifyingHours = qualifyingHoursFromCategories({
      regularHours: Number(entry.system_hours),
      trainingHours: 0,
      vacationPaidHours: Number(entry.vacation_paid_hours),
      sickPaidHours: Number(entry.sick_paid_hours),
      holidayPaidHours: Number(entry.holiday_paid_hours),
      juryDutyHours: Number(entry.jury_duty_hours),
      bereavementHours: Number(entry.bereavement_hours),
    });
    await upsertLedgerRow(supabase, "tresbe", {
      companyId: payroll.company_id,
      employeeId: employee.id,
      entryId: entry.id,
      periodYear: year,
      periodMonth: month,
      qualifyingHours,
      vacationUsedHours: Number(entry.vacation_paid_hours),
      sickUsedHours: Number(entry.sick_paid_hours),
    });
    touchedEmployeeIds.add(employee.id);
  }

  for (const employeeId of touchedEmployeeIds) {
    const employee = employeeById.get(employeeId)!;
    await replayAndPersistBalance(
      supabase,
      "tresbe",
      payroll.company_id,
      employeeId,
      employee.hiring_date,
    );
  }
}

export async function reverseLeaveAccrualForTresbePayroll(payrollId: string) {
  const supabase = await createClient();
  const { data: payroll, error: payrollError } = await supabase
    .from("tresbe_payrolls")
    .select("id,company_id")
    .eq("id", payrollId)
    .maybeSingle();
  if (payrollError) throw payrollError;
  if (!payroll) return;

  const { data: entries, error: entriesError } = await supabase
    .from("tresbe_payroll_entries")
    .select("id")
    .eq("payroll_id", payrollId);
  if (entriesError) throw entriesError;
  const entryIds = (entries ?? []).map((entry) => entry.id);
  if (!entryIds.length) return;

  const { data: reversedRows, error: reverseError } = await supabase
    .from("employee_leave_ledger_entries")
    .update({ reversed_at: new Date().toISOString() })
    .in("tresbe_entry_id", entryIds)
    .is("reversed_at", null)
    .select("tresbe_employee_id");
  if (reverseError) throw reverseError;

  const employeeIds = [
    ...new Set((reversedRows ?? []).map((row) => row.tresbe_employee_id as string)),
  ];
  if (!employeeIds.length) return;

  const { data: employees, error: employeesError } = await supabase
    .from("tresbe_employees")
    .select("id,hiring_date")
    .in("id", employeeIds);
  if (employeesError) throw employeesError;

  for (const employee of employees ?? []) {
    if (!employee.hiring_date) continue;
    await replayAndPersistBalance(
      supabase,
      "tresbe",
      payroll.company_id,
      employee.id,
      employee.hiring_date,
    );
  }
}
