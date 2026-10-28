import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  daysBetween,
  formatIsoDate,
  todayInCordoba,
  weekStartOf,
} from "@/lib/admin-client-dashboard/dates";
import type {
  ClientDashboardCard,
  DashboardActionType,
  DashboardItem,
  DashboardItemState,
} from "@/types/admin-client-dashboard";

const STALE_AFTER_DAYS = 14;

function latestByCompany<T extends { company_id: string }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows)
    if (!map.has(row.company_id)) map.set(row.company_id, row);
  return map;
}

function tresbePayrollState(
  row: { status: string; updated_at: string } | undefined,
): { state: DashboardItemState; label: string; lastUpdated: string | null } {
  if (!row)
    return {
      state: "pending",
      label: "Sin cargar esta semana",
      lastUpdated: null,
    };
  if (row.status === "draft")
    return {
      state: "in_progress",
      label: "Borrador",
      lastUpdated: row.updated_at,
    };
  if (row.status === "calculated" || row.status === "corrected")
    return {
      state: "in_progress",
      label: "Calculada",
      lastUpdated: row.updated_at,
    };
  if (row.status === "sent" || row.status === "viewed")
    return { state: "done", label: "Enviada", lastUpdated: row.updated_at };
  return { state: "done", label: "Al día", lastUpdated: row.updated_at };
}

// Sibarita paga su nómina con una semana de rezago (ver companies.notas):
// la semana vigente de pago no es la que arranca hoy, sino la anterior.
// Por eso "al día" se mide contra la última semana cargada, tolerando el
// rezago normal, en vez de exigir que exista una fila para la semana exacta
// de hoy (mismo umbral que la vista data_freshness: hasta 13 días de rezago).
const WEEKLY_PAYROLL_LAG_TOLERANCE_DAYS = 13;

function weeklyPayrollState(
  row: { status: string; week_start: string; updated_at: string } | undefined,
  today: string,
): { state: DashboardItemState; label: string; lastUpdated: string | null } {
  if (!row)
    return {
      state: "pending",
      label: "Sin cargar ninguna semana",
      lastUpdated: null,
    };
  const weekLabel = `semana del ${formatIsoDate(row.week_start)}`;
  if (row.status === "submitted")
    return {
      state: "in_progress",
      label: `Enviada, pendiente de aprobar (${weekLabel})`,
      lastUpdated: row.updated_at,
    };
  const weekEnd = addDays(row.week_start, 6);
  const daysSinceWeekEnd = daysBetween(weekEnd, today);
  const withinLag = daysSinceWeekEnd <= WEEKLY_PAYROLL_LAG_TOLERANCE_DAYS;
  if (row.status === "draft")
    return {
      state: "pending",
      label: withinLag
        ? `Borrador (${weekLabel})`
        : `Atrasada: borrador desde la ${weekLabel}`,
      lastUpdated: row.updated_at,
    };
  if (withinLag)
    return {
      state: "done",
      label: `Al día (${weekLabel})`,
      lastUpdated: row.updated_at,
    };
  return {
    state: "pending",
    label: `Atrasada desde la ${weekLabel}`,
    lastUpdated: row.updated_at,
  };
}

function invoiceWeeklyState(rows: { status: string; invoice_date: string }[]): {
  state: DashboardItemState;
  label: string;
  lastUpdated: string | null;
} {
  if (!rows.length)
    return {
      state: "pending",
      label: "Sin facturar esta semana",
      lastUpdated: null,
    };
  const lastUpdated = rows.reduce(
    (latest, r) => (r.invoice_date > latest ? r.invoice_date : latest),
    rows[0].invoice_date,
  );
  if (rows.some((r) => r.status !== "draft" && r.status !== "cancelled"))
    return { state: "done", label: "Facturado esta semana", lastUpdated };
  if (rows.some((r) => r.status === "draft"))
    return { state: "in_progress", label: "Borrador sin emitir", lastUpdated };
  return {
    state: "pending",
    label: "Sin facturar esta semana",
    lastUpdated: null,
  };
}

function recencyState(
  lastUpdated: string | null,
  today: string,
  weekStart: string,
  doneLabelPrefix: string,
  pendingLabel: string,
): { state: DashboardItemState; label: string; lastUpdated: string | null } {
  if (!lastUpdated)
    return { state: "pending", label: pendingLabel, lastUpdated: null };
  const updatedDate = lastUpdated.slice(0, 10);
  if (updatedDate >= weekStart)
    return {
      state: "done",
      label: `${doneLabelPrefix} ${formatIsoDate(updatedDate)}`,
      lastUpdated,
    };
  if (daysBetween(updatedDate, today) <= STALE_AFTER_DAYS)
    return {
      state: "in_progress",
      label: `${doneLabelPrefix} ${formatIsoDate(updatedDate)}`,
      lastUpdated,
    };
  return {
    state: "pending",
    label: `Sin actualizar desde ${formatIsoDate(updatedDate)}`,
    lastUpdated,
  };
}

export async function getAdminClientDashboard(): Promise<
  ClientDashboardCard[]
> {
  const supabase = await createClient();
  const today = todayInCordoba();
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const lookbackStart = addDays(weekStart, -21);

  const [
    companiesRes,
    configRes,
    tresbePayrollsRes,
    weeklyPayrollsRes,
    invoicesRes,
    budgetEntriesRes,
    budgetMovementsRes,
    leaveBalancesRes,
  ] = await Promise.all([
    supabase.from("companies").select("id,name,slug").order("name"),
    supabase
      .from("client_dashboard_items")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("tresbe_payrolls")
      .select("company_id,status,week_start,updated_at")
      .gte("week_start", lookbackStart)
      .order("week_start", { ascending: false }),
    supabase
      .from("weekly_payrolls")
      .select("company_id,status,week_start,updated_at")
      .gte("week_start", lookbackStart)
      .order("week_start", { ascending: false }),
    supabase
      .from("invoices")
      .select("company_id,status,invoice_date")
      .gte("invoice_date", weekStart)
      .lte("invoice_date", weekEnd),
    supabase
      .from("tresbe_budget_entries")
      .select("company_id,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("tresbe_budget_movements")
      .select("company_id,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("employee_leave_balances")
      .select("company_id,last_payroll_processed_at")
      .order("last_payroll_processed_at", { ascending: false }),
  ]);
  if (companiesRes.error) throw companiesRes.error;
  if (configRes.error) throw configRes.error;
  if (tresbePayrollsRes.error) throw tresbePayrollsRes.error;
  if (weeklyPayrollsRes.error) throw weeklyPayrollsRes.error;
  if (invoicesRes.error) throw invoicesRes.error;
  if (budgetEntriesRes.error) throw budgetEntriesRes.error;
  if (budgetMovementsRes.error) throw budgetMovementsRes.error;
  if (leaveBalancesRes.error) throw leaveBalancesRes.error;

  const currentWeekTresbe = (tresbePayrollsRes.data ?? []).filter(
    (r) => r.week_start === weekStart,
  );
  const tresbeByCompany = latestByCompany(currentWeekTresbe);
  // weekly_payroll (Sibarita) no se filtra a la semana exacta de hoy: se
  // paga con una semana de rezago, así que la fila relevante suele ser la
  // anterior (ver weeklyPayrollState). weeklyPayrollsRes ya viene ordenada
  // por week_start descendente, así que esto toma la más reciente por empresa.
  const weeklyByCompany = latestByCompany(weeklyPayrollsRes.data ?? []);

  const invoicesByCompany = new Map<
    string,
    { status: string; invoice_date: string }[]
  >();
  for (const row of invoicesRes.data ?? []) {
    const list = invoicesByCompany.get(row.company_id) ?? [];
    list.push(row);
    invoicesByCompany.set(row.company_id, list);
  }
  const budgetUpdatedByCompany = new Map<string, string>();
  for (const row of [
    ...(budgetEntriesRes.data ?? []),
    ...(budgetMovementsRes.data ?? []),
  ]) {
    const current = budgetUpdatedByCompany.get(row.company_id);
    if (!current || row.updated_at > current)
      budgetUpdatedByCompany.set(row.company_id, row.updated_at);
  }
  const leaveByCompany = latestByCompany(
    (leaveBalancesRes.data ?? []).filter((r) => r.last_payroll_processed_at),
  );

  function deriveState(
    actionType: DashboardActionType,
    companyId: string,
  ): { state: DashboardItemState; label: string; lastUpdated: string | null } {
    switch (actionType) {
      case "tresbe_payroll":
        return tresbePayrollState(tresbeByCompany.get(companyId));
      case "weekly_payroll":
        return weeklyPayrollState(weeklyByCompany.get(companyId), today);
      case "invoice_weekly":
        return invoiceWeeklyState(invoicesByCompany.get(companyId) ?? []);
      case "tresbe_budget":
        return recencyState(
          budgetUpdatedByCompany.get(companyId) ?? null,
          today,
          weekStart,
          "Actualizado al",
          "Sin actualizar",
        );
      case "leave_accrual":
        return recencyState(
          leaveByCompany.get(companyId)?.last_payroll_processed_at ?? null,
          today,
          weekStart,
          "Actualizado al",
          "Sin procesar esta semana",
        );
      case "manual":
        return { state: "pending", label: "Pendiente", lastUpdated: null };
    }
  }

  const companies = companiesRes.data ?? [];
  type ConfigRow = {
    id: string;
    company_id: string;
    key: string;
    label: string;
    action_type: DashboardActionType;
    href: string;
    manual_status: DashboardItemState | null;
    manual_status_label: string | null;
    manual_status_updated_at: string | null;
  };
  const configByCompany = new Map<string, ConfigRow[]>();
  for (const row of (configRes.data ?? []) as ConfigRow[]) {
    const list = configByCompany.get(row.company_id) ?? [];
    list.push(row);
    configByCompany.set(row.company_id, list);
  }

  return companies.map((company) => {
    const configItems = configByCompany.get(company.id) ?? [];
    const items: DashboardItem[] = configItems.map((config) => {
      if (config.action_type === "manual") {
        return {
          id: config.id,
          key: config.key,
          actionType: config.action_type,
          label: config.label,
          state: config.manual_status ?? "pending",
          stateLabel: config.manual_status_label ?? "Pendiente",
          lastUpdated: config.manual_status_updated_at,
          href: config.href,
          manual: true,
        };
      }
      const derived = deriveState(config.action_type, company.id);
      return {
        id: config.id,
        key: config.key,
        actionType: config.action_type,
        label: config.label,
        state: derived.state,
        stateLabel: derived.label,
        lastUpdated: derived.lastUpdated,
        href: config.href,
        manual: false,
      };
    });

    const hasPending = items.some((i) => i.state === "pending");
    const hasInProgress = items.some((i) => i.state === "in_progress");
    const semaphore: ClientDashboardCard["semaphore"] =
      hasPending || hasInProgress ? "amber" : "green";

    return { company, semaphore, items };
  });
}
