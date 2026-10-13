// Motor de cálculo del módulo "Informes diarios" de Cut Meat Distributors
// (Wagyu Food Service LLC). Puro y sin efectos de lado -- todo lo que
// toca Supabase vive en services/actions; esto solo transforma datos.
//
// Semana operativa: domingo a sábado (distinto del presupuesto de Tresbe,
// que usa lunes a domingo). "Recurrentes prior to this week" son los
// pendientes (no pagados) con vencimiento ANTES del domingo de la semana
// en curso; "for this week", los pendientes dentro de esa semana.

import { addDays, sundayWeekStartOf, type IsoDate } from "./dates";

export const round = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));

// ---------------------------------------------------------------------------
// Control de conciliación (QuickBooks Reconciliation Report)
// ---------------------------------------------------------------------------

export type ReconciliationLineItem = {
  reference: string;
  /** Con signo: los pendientes/outstanding se cargan en negativo. */
  amount: number;
};

export type ReconciliationControlInput = {
  statementEnding: number;
  unclearedChecks: ReconciliationLineItem[];
  unclearedDeposits: ReconciliationLineItem[];
  register: number;
};

export type ReconciliationControlResult = {
  statementEnding: number;
  unclearedChecksTotal: number;
  unclearedDepositsTotal: number;
  register: number;
  /** Statement ending + uncleared checks + uncleared deposits - Register. */
  control: number;
  /** true si el control cuadra (dentro de un centavo de redondeo). */
  balanced: boolean;
};

export function checkReconciliationControl(
  input: ReconciliationControlInput,
): ReconciliationControlResult {
  const unclearedChecksTotal = sum(
    input.unclearedChecks.map((item) => item.amount),
  );
  const unclearedDepositsTotal = sum(
    input.unclearedDeposits.map((item) => item.amount),
  );
  const control = round(
    input.statementEnding +
      unclearedChecksTotal +
      unclearedDepositsTotal -
      input.register,
  );
  return {
    statementEnding: input.statementEnding,
    unclearedChecksTotal,
    unclearedDepositsTotal,
    register: input.register,
    control,
    balanced: Math.abs(control) < 0.005,
  };
}

// ---------------------------------------------------------------------------
// Recurrentes (A/P Aging Detail Recurrentes)
// ---------------------------------------------------------------------------

export type RecurringPayment = {
  id: string;
  concept: string;
  /** Fecha de vencimiento -- es la que define en qué semana cae. */
  dueDate: IsoDate;
  amount: number;
  isPaid: boolean;
  /**
   * Monto real pagado (banco o QuickBooks), cuando ya se pagó y difiere
   * del monto recurrente esperado. Alimenta la Variación Diaria.
   */
  actualAmount?: number | null;
};

export type RecurringBucket = {
  items: RecurringPayment[];
  total: number;
};

/**
 * Separa los recurrentes NO pagados en cuatro cubetas según su
 * vencimiento, relativas al domingo de la semana del informe:
 * anteriores (prior), de esta semana, de la semana siguiente y de la
 * semana después. Los pagados no se suman en ninguna (no son deuda
 * pendiente), pero se devuelven aparte para la Variación Diaria.
 */
export function splitRecurringByWeek(
  recurring: RecurringPayment[],
  reportDate: IsoDate,
): {
  prior: RecurringBucket;
  thisWeek: RecurringBucket;
  nextWeek: RecurringBucket;
  weekAfter: RecurringBucket;
  paid: RecurringPayment[];
} {
  const weekStart = sundayWeekStartOf(reportDate);
  const thisWeekEnd = addDays(weekStart, 6);
  const nextWeekStart = addDays(weekStart, 7);
  const nextWeekEnd = addDays(weekStart, 13);
  const weekAfterStart = addDays(weekStart, 14);
  const weekAfterEnd = addDays(weekStart, 20);

  const pending = recurring.filter((item) => !item.isPaid);
  const paid = recurring.filter((item) => item.isPaid);

  const bucket = (items: RecurringPayment[]): RecurringBucket => ({
    items,
    total: sum(items.map((item) => item.amount)),
  });

  return {
    prior: bucket(pending.filter((item) => item.dueDate < weekStart)),
    thisWeek: bucket(
      pending.filter(
        (item) => item.dueDate >= weekStart && item.dueDate <= thisWeekEnd,
      ),
    ),
    nextWeek: bucket(
      pending.filter(
        (item) =>
          item.dueDate >= nextWeekStart && item.dueDate <= nextWeekEnd,
      ),
    ),
    weekAfter: bucket(
      pending.filter(
        (item) =>
          item.dueDate >= weekAfterStart && item.dueDate <= weekAfterEnd,
      ),
    ),
    paid,
  };
}

// ---------------------------------------------------------------------------
// Balance after Weekly Payments
// ---------------------------------------------------------------------------

export type WeeklyPaymentsResult = {
  register: number;
  recurrentesPrior: number;
  recurrentesThisWeek: number;
  /** Register - recurrentesPrior - recurrentesThisWeek. */
  balanceAfterWeeklyPayments: number;
};

export function buildBalanceAfterWeeklyPayments(
  register: number,
  buckets: { prior: RecurringBucket; thisWeek: RecurringBucket },
): WeeklyPaymentsResult {
  const recurrentesPrior = buckets.prior.total;
  const recurrentesThisWeek = buckets.thisWeek.total;
  return {
    register,
    recurrentesPrior,
    recurrentesThisWeek,
    balanceAfterWeeklyPayments: round(
      register - recurrentesPrior - recurrentesThisWeek,
    ),
  };
}

// ---------------------------------------------------------------------------
// Financial Report (Balance Today / 7-day / 14-day / 21-day)
// ---------------------------------------------------------------------------

export type IncomeProjectionDay = { date: IsoDate; amount: number };

/** Semana en curso (lunes a sábado), excluyendo siempre el lunes -- ya
 * reflejado en el Register o a punto de reconciliarse por separado. */
export function sumCurrentWeekProjectedIncome(
  days: IncomeProjectionDay[],
  reportDate: IsoDate,
): number {
  const weekStart = sundayWeekStartOf(reportDate);
  const monday = addDays(weekStart, 1);
  const saturday = addDays(weekStart, 6);
  return sum(
    days
      .filter((day) => day.date > monday && day.date <= saturday)
      .map((day) => day.amount),
  );
}

export type FinancialHorizonStep = {
  label: "7-day" | "14-day" | "21-day";
  date: IsoDate;
  income: number;
  recurrentes: number;
  agingAdjustment: number;
  balance: number;
};

export type FinancialReportResult = {
  balanceToday: number;
  day7: FinancialHorizonStep;
  day14: FinancialHorizonStep;
  day21: FinancialHorizonStep;
};

export function buildFinancialReport({
  reportDate,
  balanceAfterWeeklyPayments,
  currentWeekIncome,
  nextWeekBuckets,
  weekAfterBuckets,
  /** Proyección plana de ingresos para una semana completa (lunes a
   * sábado) más allá de la semana en curso -- por defecto 6 días x
   * $1,500/día, igual que la planilla. */
  flatWeeklyIncome = 9_000,
  agingAdjustments = { day7: 0, day14: 0, day21: 0 },
}: {
  reportDate: IsoDate;
  balanceAfterWeeklyPayments: number;
  currentWeekIncome: number;
  nextWeekBuckets: { total: number };
  weekAfterBuckets: { total: number };
  flatWeeklyIncome?: number;
  agingAdjustments?: { day7: number; day14: number; day21: number };
}): FinancialReportResult {
  const day7Balance = round(
    balanceAfterWeeklyPayments + currentWeekIncome + agingAdjustments.day7,
  );
  const day14Balance = round(
    day7Balance +
      flatWeeklyIncome -
      nextWeekBuckets.total +
      agingAdjustments.day14,
  );
  const day21Balance = round(
    day14Balance +
      flatWeeklyIncome -
      weekAfterBuckets.total +
      agingAdjustments.day21,
  );
  return {
    balanceToday: balanceAfterWeeklyPayments,
    day7: {
      label: "7-day",
      date: addDays(reportDate, 3),
      income: currentWeekIncome,
      recurrentes: 0,
      agingAdjustment: agingAdjustments.day7,
      balance: day7Balance,
    },
    day14: {
      label: "14-day",
      date: addDays(reportDate, 10),
      income: flatWeeklyIncome,
      recurrentes: nextWeekBuckets.total,
      agingAdjustment: agingAdjustments.day14,
      balance: day14Balance,
    },
    day21: {
      label: "21-day",
      date: addDays(reportDate, 17),
      income: flatWeeklyIncome,
      recurrentes: weekAfterBuckets.total,
      agingAdjustment: agingAdjustments.day21,
      balance: day21Balance,
    },
  };
}

// ---------------------------------------------------------------------------
// Variación Diaria y Balance GABRIEL
// ---------------------------------------------------------------------------

export type VarianceItem = {
  concept: string;
  recurringAmount: number;
  actualAmount: number;
  /** recurringAmount - actualAmount: positivo = se pagó menos de lo
   * esperado (favorable); negativo = se pagó más. */
  variance: number;
};

/**
 * Compara cada recurrente ya pagado contra su monto real (banco o
 * QuickBooks). Un recurrente pagado sin monto real informado no aporta
 * variación (se asume que coincidió).
 */
export function buildVarianceReport(paidRecurring: RecurringPayment[]): {
  items: VarianceItem[];
  totalVariance: number;
} {
  const items = paidRecurring
    .filter((item) => item.actualAmount != null)
    .map((item) => ({
      concept: item.concept,
      recurringAmount: item.amount,
      actualAmount: item.actualAmount as number,
      variance: round(item.amount - (item.actualAmount as number)),
    }));
  return { items, totalVariance: sum(items.map((item) => item.variance)) };
}

/** Balance after Weekly Payments - variación total de recurrentes. Gabriel
 * Manzanares es el dueño del negocio. */
export function buildBalanceGabriel(
  balanceAfterWeeklyPayments: number,
  totalVariance: number,
): number {
  return round(balanceAfterWeeklyPayments - totalVariance);
}

// ---------------------------------------------------------------------------
// Not entered Sales
// ---------------------------------------------------------------------------

export type NotEnteredDeposit = { description: string; amount: number };

/** Balance after Weekly Payments + depósitos que todavía no están en
 * QuickBooks (p.ej. Costco) + depósitos del día. */
export function buildBalanceWithNotEnteredSales(
  balanceAfterWeeklyPayments: number,
  notEnteredDeposits: NotEnteredDeposit[],
): number {
  return round(
    balanceAfterWeeklyPayments +
      sum(notEnteredDeposits.map((item) => item.amount)),
  );
}

// ---------------------------------------------------------------------------
// Movimientos del banco: clasificación / "POR CLASIFICAR"
// ---------------------------------------------------------------------------

export type BankMovement = {
  id: string;
  description: string;
  amount: number;
  direction: "ingreso" | "egreso";
  /** Vínculo manual a un recurrente pagado, para la Variación Diaria. */
  linkedRecurringId?: string | null;
  /** Depósito ya identificado como "Not entered Sales". */
  isNotEnteredDeposit?: boolean;
};

export type BankMovementClassification = {
  classified: BankMovement[];
  notEnteredDeposits: BankMovement[];
  /** Sin recurrente vinculado ni marca de depósito: no entra en ningún
   * balance hasta que se clasifique. */
  unclassified: BankMovement[];
};

export function classifyBankMovements(
  movements: BankMovement[],
): BankMovementClassification {
  const classified: BankMovement[] = [];
  const notEnteredDeposits: BankMovement[] = [];
  const unclassified: BankMovement[] = [];
  for (const movement of movements) {
    if (movement.linkedRecurringId) classified.push(movement);
    else if (movement.isNotEnteredDeposit) notEnteredDeposits.push(movement);
    else unclassified.push(movement);
  }
  return { classified, notEnteredDeposits, unclassified };
}

/** Recurrentes vencidos (dueDate <= reportDate) sin pago registrado --
 * para la alerta de completitud. */
export function overdueUnpaidRecurring(
  recurring: RecurringPayment[],
  reportDate: IsoDate,
): RecurringPayment[] {
  return recurring.filter(
    (item) => !item.isPaid && item.dueDate <= reportDate,
  );
}

// ---------------------------------------------------------------------------
// Aging de proveedores (A/P) y clientes (A/R)
// ---------------------------------------------------------------------------

export type AgingLine = { name: string; balance: number };

export type VendorAgingConfig = {
  includedNames: string[];
  excludedNames: string[];
  /** "Saldo de Prime Meats y sus recurrentes" -- se rastrea aparte porque
   * Prime Meats no está en este archivo de QuickBooks. */
  primeMeatsBalance: number;
};

export type VendorAgingResult = {
  rawTotal: number;
  excludedSubtotal: number;
  primeMeatsBalance: number;
  /** rawTotal - excludedSubtotal - primeMeatsBalance. */
  consolidated: number;
  /** Proveedores del aging que no están en la lista de incluidos ni en
   * la de excluidos -- para la alerta de completitud. */
  unconfiguredVendors: AgingLine[];
};

export function findUnconfiguredVendors(
  items: AgingLine[],
  config: Pick<VendorAgingConfig, "includedNames" | "excludedNames">,
): AgingLine[] {
  const excludedSet = new Set(
    config.excludedNames.map((name) => name.toLowerCase()),
  );
  const includedSet = new Set(
    config.includedNames.map((name) => name.toLowerCase()),
  );
  return items.filter(
    (item) =>
      !excludedSet.has(item.name.toLowerCase()) &&
      !includedSet.has(item.name.toLowerCase()),
  );
}

export function consolidateVendorAging(
  rawTotal: number,
  items: AgingLine[],
  config: VendorAgingConfig,
): VendorAgingResult {
  const excludedSet = new Set(
    config.excludedNames.map((name) => name.toLowerCase()),
  );
  const excludedSubtotal = sum(
    items
      .filter((item) => excludedSet.has(item.name.toLowerCase()))
      .map((item) => item.balance),
  );
  return {
    rawTotal,
    excludedSubtotal,
    primeMeatsBalance: config.primeMeatsBalance,
    consolidated: round(
      rawTotal - excludedSubtotal - config.primeMeatsBalance,
    ),
    unconfiguredVendors: findUnconfiguredVendors(items, config),
  };
}

export type CustomerAgingResult = {
  rawTotal: number;
  consolidated: number;
};

/** Hoy es un passthrough -- no hay ajuste de Prime Meats del lado de
 * clientes todavía. Queda como función propia para no tener que tocar
 * los llamadores si eso cambia. */
export function consolidateCustomerAging(rawTotal: number): CustomerAgingResult {
  return { rawTotal, consolidated: rawTotal };
}
