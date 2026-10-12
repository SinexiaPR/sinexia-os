import { createClient } from "@/lib/supabase/server";
import {
  checkDailyReportCompleteness,
} from "@/lib/cutmeat-daily/completeness";
import {
  buildBalanceAfterWeeklyPayments,
  buildBalanceGabriel,
  buildBalanceWithNotEnteredSales,
  buildFinancialReport,
  buildVarianceReport,
  checkReconciliationControl,
  classifyBankMovements,
  consolidateCustomerAging,
  consolidateVendorAging,
  splitRecurringByWeek,
  sumCurrentWeekProjectedIncome,
  type BankMovement,
  type RecurringPayment,
} from "@/lib/cutmeat-daily/calculations";
import {
  addDays,
  lastBusinessDayBefore,
  sundayWeekStartOf,
  todayInPuertoRico,
  type IsoDate,
} from "@/lib/cutmeat-daily/dates";

export type CutMeatReportStatus = "draft" | "closed" | "reopened";

export type CutMeatDailyReport = {
  id: string;
  companyId: string;
  reportDate: IsoDate;
  status: CutMeatReportStatus;
  closedAt: string | null;
  closedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CutMeatVendorConfig = {
  id: string;
  vendorName: string;
  inclusion: "included" | "excluded";
};

export type CutMeatHoliday = { id: string; holidayDate: IsoDate; label: string | null };

export type CutMeatSettings = {
  primeMeatsBalance: number;
  primeMeatsRecurring: number;
  defaultDailyIncome: number;
  flatWeeklyIncome: number;
  dataSource: "manual" | "quickbooks_api";
};

export type CutMeatGeneratedPdf = {
  id: string;
  docType: "reconciliation" | "bank" | "consolidated" | "vendors" | "customers";
  version: number;
  storagePath: string;
  generatedBy: string | null;
  generatedAt: string;
};

export async function resolveCutMeatCompany(companyId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id,name,slug")
    .eq("slug", "cut-meat-distributors");
  if (companyId) query = query.eq("id", companyId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCutMeatSettings(
  companyId: string,
): Promise<CutMeatSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    primeMeatsBalance: Number(data.prime_meats_balance),
    primeMeatsRecurring: Number(data.prime_meats_recurring),
    defaultDailyIncome: Number(data.default_daily_income),
    flatWeeklyIncome: Number(data.flat_weekly_income),
    dataSource: data.data_source,
  };
}

export async function getCutMeatVendorConfig(
  companyId: string,
): Promise<CutMeatVendorConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_vendor_config")
    .select("id,vendor_name,inclusion")
    .eq("company_id", companyId)
    .order("vendor_name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    vendorName: row.vendor_name,
    inclusion: row.inclusion,
  }));
}

export async function getCutMeatHolidays(
  companyId: string,
): Promise<CutMeatHoliday[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_holidays")
    .select("id,holiday_date,label")
    .eq("company_id", companyId)
    .order("holiday_date");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    holidayDate: row.holiday_date,
    label: row.label,
  }));
}

/** Último día hábil cerrado antes de hoy, saltando fines de semana y los
 * feriados configurados -- la fecha sugerida para el informe. */
export async function suggestReportDate(companyId: string): Promise<IsoDate> {
  const holidays = await getCutMeatHolidays(companyId);
  const holidaySet = new Set(holidays.map((h) => h.holidayDate));
  return lastBusinessDayBefore(todayInPuertoRico(), holidaySet);
}

export async function getCutMeatReport(
  companyId: string,
  reportDate: IsoDate,
): Promise<CutMeatDailyReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_reports")
    .select("*")
    .eq("company_id", companyId)
    .eq("report_date", reportDate)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    companyId: data.company_id,
    reportDate: data.report_date,
    status: data.status,
    closedAt: data.closed_at,
    closedBy: data.closed_by,
    reopenedAt: data.reopened_at,
    reopenedBy: data.reopened_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getRecentReports(
  companyId: string,
  limit = 14,
): Promise<CutMeatDailyReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_reports")
    .select("*")
    .eq("company_id", companyId)
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    reportDate: row.report_date,
    status: row.status,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    reopenedAt: row.reopened_at,
    reopenedBy: row.reopened_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getGeneratedPdfHistory(
  reportId: string,
): Promise<CutMeatGeneratedPdf[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_generated_pdfs")
    .select("*")
    .eq("report_id", reportId)
    .order("doc_type")
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    docType: row.doc_type,
    version: row.version,
    storagePath: row.storage_path,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
  }));
}

/** Un recurrente con todos sus campos editables -- superset de
 * RecurringPayment (que calculations.ts usa solo con lo que necesita para
 * calcular) para que la pantalla pueda editar sin perder datos. */
export type CutMeatRecurringPayment = RecurringPayment & {
  entryDate: IsoDate;
  itemType: string | null;
  referenceNumber: string | null;
  vendor: string | null;
  note: string | null;
};

/** Todos los recurrentes de la empresa -- el volumen es bajo (se cargan
 * a principio de mes), así que no hace falta paginar por ventana. */
export async function getRecurringPayments(
  companyId: string,
): Promise<CutMeatRecurringPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_recurring_payments")
    .select("*")
    .eq("company_id", companyId)
    .order("due_date");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    concept: row.concept,
    dueDate: row.due_date,
    amount: Number(row.amount),
    isPaid: row.is_paid,
    actualAmount: row.actual_amount == null ? null : Number(row.actual_amount),
    entryDate: row.entry_date,
    itemType: row.item_type,
    referenceNumber: row.reference_number,
    vendor: row.vendor,
    note: row.note,
  }));
}

export async function getIncomeProjection(
  companyId: string,
  from: IsoDate,
  to: IsoDate,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_income_projection")
    .select("projection_date,amount")
    .eq("company_id", companyId)
    .gte("projection_date", from)
    .lte("projection_date", to)
    .order("projection_date");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    date: row.projection_date as IsoDate,
    amount: Number(row.amount),
  }));
}

/**
 * Toda la data de un día (crudo + el cálculo completo), lista para la
 * pantalla y para generar los 5 PDF. Si todavía no existe
 * cutmeat_daily_reports para esa fecha, devuelve report: null (se crea
 * recién al guardar el primer dato, vía ensureDailyReport).
 */
export async function getDailyReportWorkspace(
  companyId: string,
  reportDate: IsoDate,
) {
  const supabase = await createClient();
  const report = await getCutMeatReport(companyId, reportDate);
  const weekStart = sundayWeekStartOf(reportDate);
  const nextWeekStart = addDays(weekStart, 7);
  const weekAfterStart = addDays(weekStart, 14);
  const weekAfterEnd = addDays(weekStart, 20);

  const [
    settings,
    vendorConfig,
    holidays,
    recurring,
    incomeDays,
    reconciliationRes,
    reconciliationItemsRes,
    bankExportRes,
    bankMovementsRes,
    agingVendorsRes,
    agingVendorItemsRes,
    agingCustomersRes,
    agingCustomerItemsRes,
    generatedPdfs,
  ] = await Promise.all([
    getCutMeatSettings(companyId),
    getCutMeatVendorConfig(companyId),
    getCutMeatHolidays(companyId),
    getRecurringPayments(companyId),
    getIncomeProjection(companyId, weekStart, addDays(weekStart, 6)),
    report
      ? supabase
          .from("cutmeat_daily_reconciliation")
          .select("*")
          .eq("report_id", report.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report
      ? supabase
          .from("cutmeat_daily_reconciliation_items")
          .select("*")
          .eq("report_id", report.id)
      : Promise.resolve({ data: [], error: null }),
    report
      ? supabase
          .from("cutmeat_daily_bank_export")
          .select("*")
          .eq("report_id", report.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report
      ? supabase
          .from("cutmeat_daily_bank_movements")
          .select("*")
          .eq("report_id", report.id)
      : Promise.resolve({ data: [], error: null }),
    report
      ? supabase
          .from("cutmeat_daily_aging_vendors")
          .select("*")
          .eq("report_id", report.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report
      ? supabase
          .from("cutmeat_daily_aging_vendor_items")
          .select("*")
          .eq("report_id", report.id)
      : Promise.resolve({ data: [], error: null }),
    report
      ? supabase
          .from("cutmeat_daily_aging_customers")
          .select("*")
          .eq("report_id", report.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    report
      ? supabase
          .from("cutmeat_daily_aging_customer_items")
          .select("*")
          .eq("report_id", report.id)
      : Promise.resolve({ data: [], error: null }),
    report ? getGeneratedPdfHistory(report.id) : Promise.resolve([]),
  ]);
  for (const result of [
    reconciliationRes,
    reconciliationItemsRes,
    bankExportRes,
    bankMovementsRes,
    agingVendorsRes,
    agingVendorItemsRes,
    agingCustomersRes,
    agingCustomerItemsRes,
  ]) {
    if (result.error) throw result.error;
  }
  if (!settings) return { report: null, settings: null } as const;

  const reconciliationRow = reconciliationRes.data;
  const reconciliationItems = (reconciliationItemsRes.data ?? []) as Array<{
    item_type: "uncleared_check" | "uncleared_deposit";
    reference: string;
    amount: number;
  }>;
  const bankMovementRows = (bankMovementsRes.data ?? []) as Array<{
    id: string;
    description: string;
    amount: number;
    direction: "ingreso" | "egreso";
    linked_recurring_id: string | null;
    is_not_entered_deposit: boolean;
    note: string | null;
  }>;
  const bankMovements: BankMovement[] = bankMovementRows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    direction: row.direction,
    linkedRecurringId: row.linked_recurring_id,
    isNotEnteredDeposit: row.is_not_entered_deposit,
  }));

  const reconciliationControl = reconciliationRow
    ? checkReconciliationControl({
        statementEnding: Number(reconciliationRow.statement_ending),
        register: Number(reconciliationRow.register),
        unclearedChecks: reconciliationItems
          .filter((item) => item.item_type === "uncleared_check")
          .map((item) => ({ reference: item.reference, amount: Number(item.amount) })),
        unclearedDeposits: reconciliationItems
          .filter((item) => item.item_type === "uncleared_deposit")
          .map((item) => ({ reference: item.reference, amount: Number(item.amount) })),
      })
    : null;

  const buckets = splitRecurringByWeek(recurring, reportDate);
  const nextWeekRecurring = recurring.filter(
    (item) =>
      !item.isPaid &&
      item.dueDate >= nextWeekStart &&
      item.dueDate <= addDays(nextWeekStart, 6),
  );
  const weekAfterRecurring = recurring.filter(
    (item) => !item.isPaid && item.dueDate >= weekAfterStart && item.dueDate <= weekAfterEnd,
  );

  const weeklyPayments = reconciliationRow
    ? buildBalanceAfterWeeklyPayments(Number(reconciliationRow.register), buckets)
    : null;
  const currentWeekIncome = sumCurrentWeekProjectedIncome(incomeDays, reportDate);
  const financial = weeklyPayments
    ? buildFinancialReport({
        reportDate,
        balanceAfterWeeklyPayments: weeklyPayments.balanceAfterWeeklyPayments,
        currentWeekIncome,
        nextWeekBuckets: { total: buckets.nextWeek.total },
        weekAfterBuckets: { total: buckets.weekAfter.total },
        flatWeeklyIncome: settings.flatWeeklyIncome,
      })
    : null;

  const { classified, notEnteredDeposits, unclassified } =
    classifyBankMovements(bankMovements);
  const paidWithActuals = buckets.paid.map((item) => {
    const linked = classified.find((m) => m.linkedRecurringId === item.id);
    return linked ? { ...item, actualAmount: linked.amount } : item;
  });
  const variance = buildVarianceReport(paidWithActuals);
  const balanceGabriel = weeklyPayments
    ? buildBalanceGabriel(weeklyPayments.balanceAfterWeeklyPayments, variance.totalVariance)
    : null;
  const balanceWithNotEntered = weeklyPayments
    ? buildBalanceWithNotEnteredSales(
        weeklyPayments.balanceAfterWeeklyPayments,
        notEnteredDeposits.map((m) => ({ description: m.description, amount: m.amount })),
      )
    : null;

  const vendorAgingConfig = {
    includedNames: vendorConfig
      .filter((v) => v.inclusion === "included")
      .map((v) => v.vendorName),
    excludedNames: vendorConfig
      .filter((v) => v.inclusion === "excluded")
      .map((v) => v.vendorName),
    primeMeatsBalance: settings.primeMeatsBalance,
  };
  const vendorItems = ((agingVendorItemsRes.data ?? []) as Array<{
    vendor_name: string;
    balance: number;
  }>).map((row) => ({ name: row.vendor_name, balance: Number(row.balance) }));
  const vendorAging = agingVendorsRes.data
    ? consolidateVendorAging(
        Number((agingVendorsRes.data as { raw_total: number }).raw_total),
        vendorItems,
        vendorAgingConfig,
      )
    : null;
  const customerItems = ((agingCustomerItemsRes.data ?? []) as Array<{
    customer_name: string;
    balance: number;
  }>).map((row) => ({ name: row.customer_name, balance: Number(row.balance) }));
  const customerAging = agingCustomersRes.data
    ? consolidateCustomerAging(
        Number((agingCustomersRes.data as { raw_total: number }).raw_total),
      )
    : null;

  const warnings = checkDailyReportCompleteness({
    reportDate,
    reconciliationControl,
    bankMovements,
    recurring,
    vendorAgingItems: vendorItems,
    vendorAgingConfig,
    sources: {
      hasReconciliation: Boolean(reconciliationRow),
      hasBankExport: Boolean(bankExportRes.data),
      hasVendorAging: Boolean(agingVendorsRes.data),
      hasCustomerAging: Boolean(agingCustomersRes.data),
    },
  });

  return {
    report,
    settings,
    vendorConfig,
    holidays,
    reportDate,
    weekStart,
    reconciliation: reconciliationRow
      ? {
          statementEnding: Number(reconciliationRow.statement_ending),
          register: Number(reconciliationRow.register),
          sourcePdfPath: reconciliationRow.source_pdf_path as string | null,
          unclearedChecks: reconciliationItems.filter(
            (item) => item.item_type === "uncleared_check",
          ),
          unclearedDeposits: reconciliationItems.filter(
            (item) => item.item_type === "uncleared_deposit",
          ),
        }
      : null,
    reconciliationControl,
    bankExport: bankExportRes.data
      ? {
          closingBalance:
            (bankExportRes.data as { closing_balance: number | null }).closing_balance,
          sourcePdfPath: (bankExportRes.data as { source_pdf_path: string | null })
            .source_pdf_path,
        }
      : null,
    bankMovements,
    unclassifiedMovements: unclassified,
    notEnteredDeposits,
    recurring,
    buckets,
    nextWeekRecurring,
    weekAfterRecurring,
    incomeDays,
    currentWeekIncome,
    weeklyPayments,
    financial,
    variance,
    balanceGabriel,
    balanceWithNotEntered,
    vendorAging,
    vendorItems,
    customerAging,
    customerItems,
    generatedPdfs,
    warnings,
  };
}

export type DailyReportWorkspace = Awaited<
  ReturnType<typeof getDailyReportWorkspace>
>;
