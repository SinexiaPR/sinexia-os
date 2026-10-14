import { createClient } from "@/lib/supabase/server";
import {
  checkDailyReportCompleteness,
} from "@/lib/cutmeat-daily/completeness";
import {
  buildBalanceAfterWeeklyPayments,
  buildBalanceGabriel,
  buildBalanceWithNotEnteredSales,
  buildFinancialReport,
  checkReconciliationControl,
  classifyBankMovements,
  consolidateCustomerAging,
  consolidateVendorAging,
  groupAgingItems,
  splitRecurringByWeek,
  splitVarianceLinesBySection,
  totalVarianceOf,
  type AgingDetailLine,
  type BankMovement,
  type RecurringPayment,
  type VarianceLine,
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
  /** Valor de arranque de Balance GABRIEL para el primer día sin un día
   * cerrado anterior (ni en vivo ni en cutmeat_daily_history). */
  gabrielStartingBalance: number;
  /** Ingreso proyectado de la semana en curso, fijo toda la semana (no
   * se prorratea por día ni se excluye el lunes). */
  currentWeekIncome: number;
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
    gabrielStartingBalance: Number(data.gabriel_starting_balance),
    currentWeekIncome: Number(data.current_week_income),
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
 * RecurringPayment (que calculations.ts usa solo con lo que necesita
 * para calcular) para que la pantalla pueda editar sin perder datos.
 * Fuente única: cutmeat_recurrentes (Fase 1) -- la tabla vieja
 * cutmeat_daily_recurring_payments se retiró por migración (ver
 * docs/CUTMEAT_DAILY_DATA_CONTRACT.md). `concept` se
 * mapea desde `vendor` (cutmeat_recurrentes no tiene un campo de
 * concepto separado) para no tener que tocar calculations.ts/pdf.ts,
 * que ya consumen RecurringPayment.concept. */
export type CutMeatRecurringPayment = RecurringPayment & {
  period: IsoDate;
  entryDate: IsoDate | null;
  itemType: string | null;
  referenceNumber: string | null;
  vendor: string;
  note: string | null;
  /** Fecha real de pago (banco/QuickBooks) -- controla cuándo una fila
   * pagada deja de mostrarse en la tabla de recurrentes del PDF. */
  paidDate: IsoDate | null;
};

function monthStartOf(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Recurrentes de la empresa relevantes para este informe: el mes del
 * informe y el mes 20 días después (la cubeta "semana después" puede
 * caer en el mes siguiente). El volumen es bajo (se cargan a principio
 * de mes), así que no hace falta paginar por ventana de fechas.
 */
export async function getRecurringPayments(
  companyId: string,
  reportDate: IsoDate,
): Promise<CutMeatRecurringPayment[]> {
  const periods = Array.from(
    new Set([monthStartOf(reportDate), monthStartOf(addDays(reportDate, 20))]),
  );
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_recurrentes")
    .select("*")
    .eq("company_id", companyId)
    .in("period", periods)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    concept: row.vendor,
    dueDate: row.due_date,
    amount: Number(row.amount),
    isPaid: row.pagado,
    actualAmount: row.paid_amount == null ? null : Number(row.paid_amount),
    period: row.period,
    entryDate: row.fecha,
    itemType: row.tr_type,
    referenceNumber: row.num,
    vendor: row.vendor,
    note: row.notes,
    paidDate: row.paid_date,
  }));
}

/**
 * Base de Balance GABRIEL del día siguiente: el balance FINAL del último
 * informe CERRADO antes de `reportDate` -- "Balance after Weekly
 * Payments + Not entered Sales" (balance_with_not_entered), no solo
 * "Balance after Weekly Payments" -- se lee de cutmeat_daily_history
 * (backfill ya aprobado, con su propio balance_after_weekly -- ese
 * backfill es anterior a esta distinción y no se toca) o del informe
 * cerrado más reciente en vivo (balance_with_not_entered congelado al
 * cerrar) -- lo que sea más reciente de los dos. null si no hay ningún
 * día cerrado anterior (primer día del módulo).
 */
export async function getPreviousClosedBalance(
  companyId: string,
  reportDate: IsoDate,
): Promise<{ date: IsoDate; balance: number } | null> {
  const supabase = await createClient();
  const [historyRes, reportRes] = await Promise.all([
    supabase
      .from("cutmeat_daily_history")
      .select("report_date,balance_after_weekly")
      .eq("company_id", companyId)
      .lt("report_date", reportDate)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cutmeat_daily_reports")
      .select("report_date,balance_with_not_entered")
      .eq("company_id", companyId)
      .eq("status", "closed")
      .not("balance_with_not_entered", "is", null)
      .lt("report_date", reportDate)
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (historyRes.error) throw historyRes.error;
  if (reportRes.error) throw reportRes.error;
  const candidates = [
    historyRes.data
      ? { date: historyRes.data.report_date as IsoDate, balance: Number(historyRes.data.balance_after_weekly) }
      : null,
    reportRes.data
      ? { date: reportRes.data.report_date as IsoDate, balance: Number(reportRes.data.balance_with_not_entered) }
      : null,
  ].filter((candidate): candidate is { date: IsoDate; balance: number } => candidate !== null);
  if (!candidates.length) return null;
  return candidates.reduce((latest, candidate) => (candidate.date > latest.date ? candidate : latest));
}

/** Líneas libres de Variación Diaria de este informe (concepto + monto,
 * sin tipos fijos), en el orden en que se cargaron. */
export async function getVarianceLines(reportId: string): Promise<VarianceLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_variance_lines")
    .select("id,concept,amount,section")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    concept: row.concept,
    amount: Number(row.amount),
    section: row.section as VarianceLine["section"],
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

type AgingItemRow = Record<string, unknown> & {
  balance: number;
  txn_date: string | null;
  txn_type: string | null;
  num: string | null;
  due_date: string | null;
  amount: number | null;
  open_balance: number | null;
};

function mapAgingItemRow(
  row: AgingItemRow,
  nameColumn: "vendor_name" | "customer_name",
): AgingDetailLine {
  return {
    name: row[nameColumn] as string,
    balance: Number(row.balance),
    txnDate: (row.txn_date as IsoDate | null) ?? null,
    txnType: row.txn_type ?? null,
    num: row.num ?? null,
    dueDate: (row.due_date as IsoDate | null) ?? null,
    amount: row.amount == null ? null : Number(row.amount),
    openBalance: row.open_balance == null ? null : Number(row.open_balance),
  };
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
    previousClosed,
    reconciliationRes,
    reconciliationItemsRes,
    bankExportRes,
    bankMovementsRes,
    agingVendorsRes,
    agingVendorItemsRes,
    agingCustomersRes,
    agingCustomerItemsRes,
    generatedPdfs,
    varianceLines,
  ] = await Promise.all([
    getCutMeatSettings(companyId),
    getCutMeatVendorConfig(companyId),
    getCutMeatHolidays(companyId),
    getRecurringPayments(companyId, reportDate),
    getIncomeProjection(companyId, weekStart, addDays(weekStart, 6)),
    getPreviousClosedBalance(companyId, reportDate),
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
    report ? getVarianceLines(report.id) : Promise.resolve([]),
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
    item_type: "uncleared_check" | "uncleared_deposit" | "cleared_check" | "cleared_deposit";
    reference: string;
    amount: number;
    tranche: "as_of" | "after" | null;
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
          .map((item) => ({ reference: item.reference, amount: Number(item.amount), tranche: item.tranche ?? undefined })),
        unclearedDeposits: reconciliationItems
          .filter((item) => item.item_type === "uncleared_deposit")
          .map((item) => ({ reference: item.reference, amount: Number(item.amount), tranche: item.tranche ?? undefined })),
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
  // Ingresos de la semana en curso: valor plano configurado (no se
  // prorratea por día ni se excluye el lunes) -- ver
  // cutmeat_daily_settings.current_week_income.
  const currentWeekIncome = settings.currentWeekIncome;
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

  const { notEnteredDeposits, unclassified } = classifyBankMovements(bankMovements);
  // Balance GABRIEL = B del último día CERRADO anterior (en vivo o del
  // backfill de cutmeat_daily_history) -- no depende de la conciliación
  // de HOY, así que se calcula aunque todavía no se haya cargado.
  const balanceGabriel = buildBalanceGabriel(
    previousClosed?.balance ?? null,
    settings.gabrielStartingBalance,
  );
  // Solo la sección "variance" (diferencias de pago, cargos del banco):
  // es la que concilia Balance GABRIEL -> Balance Today. Los depósitos sin
  // cobrar puntuales ("uncollected_deposit", p.ej. Costco) se muestran en
  // su propio bloque y entran aparte en "Balance after Weekly Payments +
  // Not entered Sales" (ver balanceWithNotEntered) -- sumarlos acá
  // también los contaba dos veces (mostraba 223.56 en vez de -122.72 el
  // 09/10/2026, con Costco de por medio).
  const totalVariance = totalVarianceOf(
    varianceLines.filter((line) => line.section === "variance"),
  );
  // balanceWithNotEntered (congelado al cerrar -> Gabriel del día
  // siguiente) parte de la MISMA cadena Gabriel + Variación que usa la
  // página 2 del Consolidated (balanceAfterVariance), no del Balance
  // Today basado en Register (weeklyPayments.balanceAfterWeeklyPayments)
  // -- si se usa ese último y encima se le suman los depósitos del día,
  // cuando hay una línea "uncollected_deposit" en la Variación Diaria
  // (p.ej. Costco del 10/12) los depósitos se cuentan dos veces: una ya
  // implícita en el Register (vía Uncleared deposits de la
  // conciliación) y otra explícita acá. Con Gabriel + variación (ambas
  // secciones) + depósitos del día, nunca se duplican -- y para el
  // 09/10 (sin línea "uncollected_deposit") da el mismo resultado de
  // siempre (uncollectedTotal = 0).
  const { uncollectedDeposits: uncollectedDepositLines } = splitVarianceLinesBySection(varianceLines);
  const uncollectedTotal = totalVarianceOf(uncollectedDepositLines);
  const balanceAfterVariance =
    balanceGabriel == null ? null : balanceGabriel + totalVariance + uncollectedTotal;
  const balanceWithNotEntered = balanceAfterVariance == null
    ? null
    : buildBalanceWithNotEnteredSales(
        balanceAfterVariance,
        notEnteredDeposits.map((m) => ({ description: m.description, amount: m.amount })),
      );

  const vendorAgingConfig = {
    includedNames: vendorConfig
      .filter((v) => v.inclusion === "included")
      .map((v) => v.vendorName),
    excludedNames: vendorConfig
      .filter((v) => v.inclusion === "excluded")
      .map((v) => v.vendorName),
    primeMeatsBalance: settings.primeMeatsBalance,
  };
  const vendorItemRows = (agingVendorItemsRes.data ?? []) as AgingItemRow[];
  const vendorItems = vendorItemRows.map((row) => mapAgingItemRow(row, "vendor_name"));
  const vendorGroups = groupAgingItems(vendorItems);
  const vendorAging = agingVendorsRes.data
    ? consolidateVendorAging(
        Number((agingVendorsRes.data as { raw_total: number }).raw_total),
        vendorItems,
        vendorAgingConfig,
      )
    : null;
  const customerItemRows = (agingCustomerItemsRes.data ?? []) as AgingItemRow[];
  const customerItems = customerItemRows.map((row) => mapAgingItemRow(row, "customer_name"));
  const customerGroups = groupAgingItems(customerItems);
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
    varianceReconciliation:
      financial && balanceGabriel != null
        ? {
            balanceGabriel,
            varianceLines,
            notEnteredDepositsTotal: notEnteredDeposits.reduce((sum, item) => sum + item.amount, 0),
            balanceToday: financial.balanceToday,
          }
        : null,
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
          asOfDate: (reconciliationRow as { as_of_date: string | null }).as_of_date as IsoDate | null,
          beginningBalance:
            (reconciliationRow as { beginning_balance: number | null }).beginning_balance == null
              ? null
              : Number((reconciliationRow as { beginning_balance: number | null }).beginning_balance),
          sourcePdfPath: reconciliationRow.source_pdf_path as string | null,
          loadedAt: reconciliationRow.loaded_at as string | null,
          unclearedChecks: reconciliationItems.filter(
            (item) => item.item_type === "uncleared_check",
          ),
          unclearedDeposits: reconciliationItems.filter(
            (item) => item.item_type === "uncleared_deposit",
          ),
          clearedChecks: reconciliationItems.filter((item) => item.item_type === "cleared_check"),
          clearedDeposits: reconciliationItems.filter((item) => item.item_type === "cleared_deposit"),
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
    varianceLines,
    totalVariance,
    balanceGabriel,
    previousClosedBalance: previousClosed,
    balanceWithNotEntered,
    vendorAging,
    vendorItems,
    vendorGroups,
    customerAging,
    customerItems,
    customerGroups,
    generatedPdfs,
    warnings,
  };
}

export type DailyReportWorkspace = Awaited<
  ReturnType<typeof getDailyReportWorkspace>
>;
