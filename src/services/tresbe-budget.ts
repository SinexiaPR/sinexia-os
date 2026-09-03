import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  weekDates,
  weekNumber,
  weekStartFromNumber,
  weekStartOf,
  todayInPuertoRico,
  type IsoDate,
} from "@/lib/tresbe-budget/dates";
import {
  buildWeekView,
  buildHorizonSummary,
} from "@/lib/tresbe-budget/calculations";

export type BudgetCategoryKind =
  | "ingreso"
  | "egreso"
  | "financiamiento"
  | "intercompany"
  | "financiamiento_externo"
  | "transferencia_interna";
export type BudgetTotalGroup =
  | "ingresos"
  | "proveedores_compras"
  | "nomina"
  | "payroll_taxes"
  | "debitos_bancarios"
  | "intercompany"
  | "financiamiento"
  | "financiamiento_externo"
  | "transferencia_interna";
export type BudgetOrigin = "calculado" | "manual";

export type BudgetCategory = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  kind: BudgetCategoryKind;
  total_group: BudgetTotalGroup;
  is_financing: boolean;
  flow: "entrada" | "salida" | null;
  sort_order: number;
  is_active: boolean;
};

export type BudgetMovement = {
  id: string;
  company_id: string;
  entry_date: IsoDate;
  week_start: IsoDate;
  direction: "ingreso" | "egreso";
  category_id: string;
  concept: string;
  counterparty: string | null;
  amount: number;
  account: string | null;
  note: string | null;
  counterparty_id: string | null;
  created_at: string;
};

export type BudgetEntry = {
  id: string;
  company_id: string;
  entry_date: IsoDate;
  week_start: IsoDate;
  category_id: string;
  amount: number;
  origin: BudgetOrigin;
  note: string | null;
  generated_at: string | null;
  updated_at: string;
};

export type BudgetCashControl = {
  id: string;
  company_id: string;
  week_start: IsoDate;
  opening_bank_balance: number;
  actual_bank_balance: number | null;
  opening_cash_balance: number;
  actual_cash_balance: number | null;
  minimum_cash_target: number | null;
  notes: string | null;
};

export type BudgetSettings = {
  id: string;
  company_id: string;
  week_one_start: IsoDate;
  forecast_weeks: number;
  processor_fee_rate: number;
  loan_holdback_rate: number;
  card_settlement_lag_days: number;
  payroll_amount: number;
  payroll_weekday: number;
  related_cash_out_label: string | null;
  related_cash_out_amount: number;
  related_cash_out_enabled: boolean;
  payroll_tax_rate: number;
  payroll_tax_offset_days: number;
  credit_line_opening_balance: number;
};

export type BudgetSalesPattern = {
  id: string;
  company_id: string;
  weekday: number;
  gross_sales: number;
  card_share: number;
};

export type BudgetRecurringDebit = {
  id: string;
  company_id: string;
  concept: string;
  classification: string | null;
  category_id: string;
  amount: number;
  frequency: "semanal" | "quincenal" | "mensual";
  weekday: number | null;
  day_of_month: number | null;
  weekend_shift: "ninguno" | "viernes_anterior" | "lunes_siguiente";
  confidence: "alta" | "media" | "baja";
  is_active: boolean;
  note: string | null;
};

export type BudgetVendorSchedule = {
  id: string;
  company_id: string;
  vendor_name: string;
  vendor_type:
    "proveedor_activo" | "recurrente_al_dia" | "compra_mercaderia_cash";
  category_id: string;
  weekday: number;
  amount: number;
  is_active: boolean;
  note: string | null;
};

export type BudgetCounterparty = {
  id: string;
  company_id: string;
  name: string;
  opening_balance: number;
  is_active: boolean;
};

export type BudgetAssumptions = {
  settings: BudgetSettings;
  salesPattern: BudgetSalesPattern[];
  recurringDebits: BudgetRecurringDebit[];
  vendorSchedule: BudgetVendorSchedule[];
};

export async function resolveTresbeCompany(companyId?: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("id,name,slug")
    .eq("slug", "tresbe");
  if (companyId) query = query.eq("id", companyId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getBudgetCategories(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tresbe_budget_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as BudgetCategory[];
}

export async function getBudgetCounterparties(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tresbe_budget_counterparties")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as BudgetCounterparty[];
}

/**
 * Saldos al inicio de la semana. El ancla del horizonte trae los saldos de
 * arranque y desde ahí se encadenan los movimientos previos, así no hay que
 * volver a escribir a mano el saldo inicial de cada semana como en la planilla.
 */
export async function getOpeningBalances(
  companyId: string,
  weekStart: IsoDate,
  settings: BudgetSettings | null,
  counterparties: BudgetCounterparty[],
) {
  const supabase = await createClient();
  const anchor = settings ? weekStartOf(settings.week_one_start) : weekStart;
  const openings: Record<string, number> = {};
  for (const counterparty of counterparties) {
    openings[counterparty.id] = Number(counterparty.opening_balance);
  }
  let creditLine = Number(settings?.credit_line_opening_balance ?? 0);
  if (weekStart <= anchor) {
    return { creditLine, counterparties: openings };
  }
  const { data, error } = await supabase
    .from("tresbe_budget_movements")
    .select("amount,counterparty_id,tresbe_budget_categories(code,kind)")
    .eq("company_id", companyId)
    .gte("entry_date", anchor)
    .lt("entry_date", weekStart);
  if (error) throw error;
  for (const row of (data ?? []) as unknown as Array<{
    amount: number;
    counterparty_id: string | null;
    tresbe_budget_categories: { code: string } | Array<{ code: string }> | null;
  }>) {
    const joined = row.tresbe_budget_categories;
    const code = Array.isArray(joined) ? joined[0]?.code : joined?.code;
    const amount = Number(row.amount);
    // El saldo de la línea es un pasivo: utilizar aumenta la deuda (más
    // negativo) y repagar la reduce -- se mueve con (Repago - Utilización).
    if (code === "linea_credito_utilizacion") creditLine -= amount;
    else if (code === "linea_credito_repago") creditLine += amount;
    else if (code === "intercompany_recibido" && row.counterparty_id) {
      openings[row.counterparty_id] =
        Math.round(((openings[row.counterparty_id] ?? 0) + amount) * 100) / 100;
    } else if (code === "intercompany_entregado" && row.counterparty_id) {
      openings[row.counterparty_id] =
        Math.round(((openings[row.counterparty_id] ?? 0) - amount) * 100) / 100;
    }
  }
  creditLine = Math.round(creditLine * 100) / 100;
  return { creditLine, counterparties: openings };
}

export async function getBudgetAssumptions(
  companyId: string,
): Promise<BudgetAssumptions | null> {
  const supabase = await createClient();
  const [settings, pattern, debits, vendors] = await Promise.all([
    supabase
      .from("tresbe_budget_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("tresbe_budget_sales_pattern")
      .select("*")
      .eq("company_id", companyId)
      .order("weekday"),
    supabase
      .from("tresbe_budget_recurring_debits")
      .select("*")
      .eq("company_id", companyId)
      .order("concept"),
    supabase
      .from("tresbe_budget_vendor_schedule")
      .select("*")
      .eq("company_id", companyId)
      .order("weekday")
      .order("vendor_name"),
  ]);
  for (const result of [settings, pattern, debits, vendors]) {
    if (result.error) throw result.error;
  }
  if (!settings.data) return null;
  return {
    settings: settings.data as BudgetSettings,
    salesPattern: (pattern.data ?? []) as BudgetSalesPattern[],
    recurringDebits: (debits.data ?? []) as BudgetRecurringDebit[],
    vendorSchedule: (vendors.data ?? []) as BudgetVendorSchedule[],
  };
}

/**
 * Datos crudos de una semana. El forecast necesita mirar los días previos al
 * lunes porque el depósito de tarjeta se acredita con retraso.
 */
export async function getBudgetWeekData(companyId: string, weekStart: IsoDate) {
  const supabase = await createClient();
  const weekEnd = addDays(weekStart, 6);
  const [movements, entries, cashControl] = await Promise.all([
    supabase
      .from("tresbe_budget_movements")
      .select("*")
      .eq("company_id", companyId)
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd)
      .order("entry_date")
      .order("created_at"),
    supabase
      .from("tresbe_budget_entries")
      .select("*")
      .eq("company_id", companyId)
      .gte("entry_date", weekStart)
      .lte("entry_date", weekEnd),
    supabase
      .from("tresbe_budget_cash_control")
      .select("*")
      .eq("company_id", companyId)
      .eq("week_start", weekStart)
      .maybeSingle(),
  ]);
  for (const result of [movements, entries, cashControl]) {
    if (result.error) throw result.error;
  }
  return {
    movements: (movements.data ?? []) as BudgetMovement[],
    entries: (entries.data ?? []) as BudgetEntry[],
    cashControl: (cashControl.data ?? null) as BudgetCashControl | null,
  };
}

export async function getBudgetWeekWorkspace(
  companyId: string,
  requestedWeek?: string | null,
) {
  const [categories, assumptions, counterparties] = await Promise.all([
    getBudgetCategories(companyId),
    getBudgetAssumptions(companyId),
    getBudgetCounterparties(companyId),
  ]);
  const weekStart = weekStartOf(
    requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
      ? requestedWeek
      : todayInPuertoRico(),
  );
  const [{ movements, entries, cashControl }, openings] = await Promise.all([
    getBudgetWeekData(companyId, weekStart),
    getOpeningBalances(
      companyId,
      weekStart,
      assumptions?.settings ?? null,
      counterparties,
    ),
  ]);
  const week = buildWeekView({
    weekStart,
    categories,
    movements,
    entries,
    cashControl,
    counterparties,
    openings,
  });
  return {
    weekStart,
    weekDates: weekDates(weekStart),
    weekNumber: assumptions
      ? weekNumber(assumptions.settings.week_one_start, weekStart)
      : null,
    categories,
    counterparties,
    assumptions,
    movements,
    entries,
    cashControl,
    week,
  };
}

/** Resumen del horizonte configurado (13 semanas por defecto). */
export async function getBudgetHorizonSummary(
  companyId: string,
  anchorWeek?: string | null,
) {
  const supabase = await createClient();
  const [categories, assumptions] = await Promise.all([
    getBudgetCategories(companyId),
    getBudgetAssumptions(companyId),
  ]);
  const weeks = assumptions?.settings.forecast_weeks ?? 13;
  const firstWeek = assumptions
    ? weekStartOf(anchorWeek ?? assumptions.settings.week_one_start)
    : weekStartOf(anchorWeek ?? todayInPuertoRico());
  const lastDay = addDays(firstWeek, weeks * 7 - 1);
  const [movements, entries, cashControls] = await Promise.all([
    supabase
      .from("tresbe_budget_movements")
      .select("*")
      .eq("company_id", companyId)
      .gte("entry_date", firstWeek)
      .lte("entry_date", lastDay),
    supabase
      .from("tresbe_budget_entries")
      .select("*")
      .eq("company_id", companyId)
      .gte("entry_date", firstWeek)
      .lte("entry_date", lastDay),
    supabase
      .from("tresbe_budget_cash_control")
      .select("*")
      .eq("company_id", companyId)
      .gte("week_start", firstWeek)
      .lte("week_start", addDays(firstWeek, (weeks - 1) * 7)),
  ]);
  for (const result of [movements, entries, cashControls]) {
    if (result.error) throw result.error;
  }
  return {
    firstWeek,
    weeks,
    weekOneStart: assumptions?.settings.week_one_start ?? firstWeek,
    rows: buildHorizonSummary({
      firstWeek,
      weeks,
      weekOneStart: assumptions?.settings.week_one_start ?? firstWeek,
      categories,
      movements: (movements.data ?? []) as BudgetMovement[],
      entries: (entries.data ?? []) as BudgetEntry[],
      cashControls: (cashControls.data ?? []) as BudgetCashControl[],
    }),
  };
}

export { weekStartFromNumber };
