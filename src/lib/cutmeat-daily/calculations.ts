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
  /**
   * El Reconciliation Report real de QuickBooks no es un solo corte: a
   * veces el informe diario (reportDate) es POSTERIOR a la última
   * conciliación bancaria real (p.ej. el 10/12 reconciliando contra el
   * statement de FIRST BANK fechado 10/09) -- entonces hay partidas
   * pendientes "as of" esa fecha de conciliación Y partidas nuevas
   * "after" esa fecha, hasta hoy. Ambas suman al mismo control (ninguna
   * se neteá contra la otra) -- tranche es solo para el desglose visual
   * del PDF. Sin tranche (filas ya cargadas antes de esta distinción,
   * p.ej. el 09/10 cerrado) se trata como "as_of" por compatibilidad.
   */
  tranche?: "as_of" | "after";
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
  /** Desglose por tramo, para la réplica del Reconciliation Report real. */
  asOfChecksTotal: number;
  afterChecksTotal: number;
  asOfDepositsTotal: number;
  afterDepositsTotal: number;
  /** Statement ending + tramo "as of" únicamente -- el Register balance
   * de la fecha de la última conciliación bancaria real, antes de sumar
   * lo nuevo "after" hasta el día del informe. */
  registerAsOf: number;
};

export function checkReconciliationControl(
  input: ReconciliationControlInput,
): ReconciliationControlResult {
  const byTranche = (items: ReconciliationLineItem[], tranche: "as_of" | "after") =>
    sum(items.filter((item) => (item.tranche ?? "as_of") === tranche).map((item) => item.amount));
  const unclearedChecksTotal = sum(
    input.unclearedChecks.map((item) => item.amount),
  );
  const unclearedDepositsTotal = sum(
    input.unclearedDeposits.map((item) => item.amount),
  );
  const asOfChecksTotal = byTranche(input.unclearedChecks, "as_of");
  const afterChecksTotal = byTranche(input.unclearedChecks, "after");
  const asOfDepositsTotal = byTranche(input.unclearedDeposits, "as_of");
  const afterDepositsTotal = byTranche(input.unclearedDeposits, "after");
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
    asOfChecksTotal,
    afterChecksTotal,
    asOfDepositsTotal,
    afterDepositsTotal,
    registerAsOf: round(input.statementEnding + asOfChecksTotal + asOfDepositsTotal),
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
// A/P Aging Detail Recurrentes -- tabla completa (réplica de Hernan)
// ---------------------------------------------------------------------------

/** Un recurrente con todos los campos de cutmeat_recurrentes que hacen
 * falta para reproducir la tabla de Hernan (Date/Tr Type/Num/Vendor/Due
 * Date/Amount), no solo concept/dueDate/amount/isPaid. */
export type RecurringDetailRow = {
  entryDate: IsoDate | null;
  itemType: string | null;
  referenceNumber: string | null;
  vendor: string;
  dueDate: IsoDate | null;
  amount: number;
  isPaid: boolean;
  /** Fecha real de pago (banco/QuickBooks). Si es null con isPaid=true,
   * se usa dueDate como mejor estimado -- ver nota de visibilidad abajo. */
  paidDate?: IsoDate | null;
};

export type RecurringDetailBucket = {
  rows: RecurringDetailRow[];
  /** Suma de los no pagados de este bucket -- los pagados nunca suman. */
  total: number;
};

export type RecurringDetailTable = {
  prior: RecurringDetailBucket;
  thisWeek: RecurringDetailBucket;
  nextWeek: RecurringDetailBucket;
  weekAfter: RecurringDetailBucket;
  /** prior.total + thisWeek.total + nextWeek.total + weekAfter.total,
   * siempre recalculado desde las filas -- nunca un subtotal guardado. */
  grandTotal: number;
};

/**
 * Agrupa TODOS los recurrentes relevantes del mes en 4 cubetas por
 * vencimiento -- anteriores a esta semana, esta semana, la semana
 * siguiente (14 días) y la semana después (21 días) -- cada fila en
 * exactamente UN bloque (por construcción: los rangos de fecha no se
 * superponen), con un subtotal "Total-Week" por cubeta y un total
 * general = suma de las 4. Esto es intencionalmente distinto del rango
 * fijo de celdas que usaba el Sheet de Hernan (K10:K15), que arrancaba
 * dentro de "prior" y por eso descontaba NOMINA/IRS/Hacienda dos veces.
 *
 * Un recurrente pagado (isPaid=true) nunca suma a ningún total. Se
 * muestra en gris SOLO el día de su pago (paidDate, o dueDate si no hay
 * paidDate informado) -- al día siguiente desaparece de la tabla, igual
 * que en los informes de Hernan.
 *
 * Los pendientes sin vencimiento (p.ej. un recurrente todavía sin
 * facturar, monto $0 -- "Carlos Mercado Seguros") van en la cubeta
 * "prior" sin afectar ningún total real.
 */
export function buildRecurringDetailTable(
  recurring: RecurringDetailRow[],
  reportDate: IsoDate,
): RecurringDetailTable {
  const weekStart = sundayWeekStartOf(reportDate);
  const thisWeekEnd = addDays(weekStart, 6);
  const nextWeekStart = addDays(weekStart, 7);
  const nextWeekEnd = addDays(weekStart, 13);
  const weekAfterStart = addDays(weekStart, 14);
  const weekAfterEnd = addDays(weekStart, 20);

  type BucketKey = "prior" | "thisWeek" | "nextWeek" | "weekAfter";
  const classify = (dueDate: IsoDate | null): BucketKey | null => {
    if (dueDate == null) return null;
    if (dueDate < weekStart) return "prior";
    if (dueDate <= thisWeekEnd) return "thisWeek";
    if (dueDate >= nextWeekStart && dueDate <= nextWeekEnd) return "nextWeek";
    if (dueDate >= weekAfterStart && dueDate <= weekAfterEnd) return "weekAfter";
    return null;
  };

  // Un recurrente pagado solo se muestra el día exacto de su pago; antes
  // o después de ese día, desaparece de la tabla (no solo del total).
  const visible = recurring.filter((item) => {
    if (!item.isPaid) return true;
    const effectivePaidDate = item.paidDate ?? item.dueDate;
    return effectivePaidDate === reportDate;
  });

  const grouped: Record<BucketKey, RecurringDetailRow[]> = {
    prior: [],
    thisWeek: [],
    nextWeek: [],
    weekAfter: [],
  };
  // Los recurrentes sin vencimiento (p.ej. un recordatorio todavía sin
  // facturar, monto $0) no tienen una cubeta propia -- se insertan
  // aparte, abajo, en el mismo lugar donde Hernan los pone a mano: uno
  // cerca del principio de "prior" y, si hay un segundo, al principio de
  // "nextWeek" (justo donde termina "this week"). Un tercero en
  // adelante (no visto todavía) se agrega al final de "prior" para no
  // perderlo en silencio.
  const undated: RecurringDetailRow[] = [];
  for (const item of visible) {
    if (item.dueDate == null) {
      undated.push(item);
      continue;
    }
    const key = classify(item.dueDate);
    if (key) grouped[key].push(item);
  }

  const sortRows = (rows: RecurringDetailRow[]) =>
    [...rows].sort((a, b) => {
      const ad = a.dueDate ?? "";
      const bd = b.dueDate ?? "";
      if (ad !== bd) return ad < bd ? -1 : 1;
      const ae = a.entryDate ?? "";
      const be = b.entryDate ?? "";
      return ae < be ? -1 : ae > be ? 1 : 0;
    });

  const priorRows = sortRows(grouped.prior);
  const nextWeekRows = sortRows(grouped.nextWeek);
  undated.forEach((item, index) => {
    if (index % 2 === 0) {
      // Primero: después de la primera fila de "prior" (o al principio
      // si "prior" está vacío).
      priorRows.splice(Math.min(1, priorRows.length), 0, item);
    } else if (index === 1) {
      // Segundo: al principio de "nextWeek".
      nextWeekRows.unshift(item);
    } else {
      // Un tercero (o más) en adelante: al final de "prior", para no
      // perderlo.
      priorRows.push(item);
    }
  });

  const makeBucket = (rows: RecurringDetailRow[]): RecurringDetailBucket => ({
    rows,
    total: sum(rows.filter((row) => !row.isPaid).map((row) => row.amount)),
  });

  const prior = makeBucket(priorRows);
  const thisWeek = makeBucket(sortRows(grouped.thisWeek));
  const nextWeek = makeBucket(nextWeekRows);
  const weekAfter = makeBucket(sortRows(grouped.weekAfter));
  return {
    prior,
    thisWeek,
    nextWeek,
    weekAfter,
    grandTotal: sum([prior.total, thisWeek.total, nextWeek.total, weekAfter.total]),
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
   * sábado) más allá de la semana en curso -- configurable en
   * cutmeat_daily_settings (flat_weekly_income), por defecto $9,000. */
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
  // Las etiquetas 7/14/21 días son el sábado de la semana (domingo a
  // sábado) que contiene reportDate, + 2/9/16 días -- no reportDate + 3/10/17
  // directamente. Ej.: informe 10/06 -> sábado 10/10 -> 10/12, 10/19, 10/26.
  const saturdayOfWeek = addDays(sundayWeekStartOf(reportDate), 6);
  return {
    balanceToday: balanceAfterWeeklyPayments,
    day7: {
      label: "7-day",
      date: addDays(saturdayOfWeek, 2),
      income: currentWeekIncome,
      recurrentes: 0,
      agingAdjustment: agingAdjustments.day7,
      balance: day7Balance,
    },
    day14: {
      label: "14-day",
      date: addDays(saturdayOfWeek, 9),
      income: flatWeeklyIncome,
      recurrentes: nextWeekBuckets.total,
      agingAdjustment: agingAdjustments.day14,
      balance: day14Balance,
    },
    day21: {
      label: "21-day",
      date: addDays(saturdayOfWeek, 16),
      income: flatWeeklyIncome,
      recurrentes: weekAfterBuckets.total,
      agingAdjustment: agingAdjustments.day21,
      balance: day21Balance,
    },
  };
}

// ---------------------------------------------------------------------------
// Variación Diaria (líneas libres) y Balance GABRIEL
// ---------------------------------------------------------------------------

/** "variance": Variación Diaria propiamente dicha (diferencias de pago de
 * recurrentes, cargos del banco, etc.). "uncollected_deposit": cheques o
 * depósitos puntuales todavía sin cobrar (Costco Wholesale, The Butcher)
 * -- se separan en su propio bloque en la pantalla y el PDF en vez de
 * mezclarse con la Variación Diaria, aunque siguen sumando al mismo
 * total. */
export type VarianceLineSection = "variance" | "uncollected_deposit";

/** Línea libre de Variación Diaria (concepto + monto), como la carga
 * Hernan hoy -- sin tipos fijos ni clasificación automática. Conceptos ya
 * vistos: "Diferencia Pago Recurrentes (vendor)", "First Bank - Service
 * Charges", "Recurrentes de la Semana", "Aging", cheques/depósitos sin
 * cobrar puntuales (Costco Wholesale, The Butcher). */
export type VarianceLine = {
  id?: string;
  concept: string;
  amount: number;
  section: VarianceLineSection;
};

export function totalVarianceOf(lines: VarianceLine[]): number {
  return sum(lines.map((line) => line.amount));
}

/** Separa las líneas de Variación Diaria por sección, en el orden en que
 * llegaron, para mostrarlas en bloques distintos (pantalla y PDF). El
 * total general sigue siendo la suma de todas sin importar la sección. */
export function splitVarianceLinesBySection(lines: VarianceLine[]): {
  variance: VarianceLine[];
  uncollectedDeposits: VarianceLine[];
} {
  return {
    variance: lines.filter((line) => line.section === "variance"),
    uncollectedDeposits: lines.filter((line) => line.section === "uncollected_deposit"),
  };
}

/**
 * Balance GABRIEL = balance FINAL del último informe CERRADO anterior --
 * "Balance after Weekly Payments + Not entered Sales" (de
 * cutmeat_daily_history o del día anterior cerrado en vivo), no solo
 * "Balance after Weekly Payments" sin los depósitos del día todavía no
 * ingresados en QuickBooks -- NI "B - variación". Para el primer día sin
 * anterior, usa el valor de arranque configurable
 * (cutmeat_daily_settings.gabriel_starting_balance).
 */
export function buildBalanceGabriel(
  previousClosedBalanceWithNotEntered: number | null,
  startingBalance: number,
): number {
  return round(previousClosedBalanceWithNotEntered ?? startingBalance);
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

/**
 * Ecuación de control de la Variación Diaria: Balance Today (calculado
 * desde el Register de QuickBooks, independiente) debe poder
 * reconstruirse como Balance GABRIEL + variación de cheques/pagos +
 * variación de depósitos + Depósitos del día -- 4 términos que se suman,
 * ninguno neteado contra otro: "variación de depósitos" (sección
 * "uncollected_deposit" de Variación Diaria -- p.ej. la reversa de un
 * "Not entered Sales" de un día anterior que ya entró al register) y
 * "Depósitos del día" (notEnteredDepositsTotal -- los depósitos de HOY
 * todavía no ingresados en QuickBooks) son cosas distintas, de días
 * distintos; no hay que restar una de la otra. Si no cuadra (más allá de
 * un centavo de redondeo), hay un movimiento sin clasificar -- el
 * llamador debe bloquear, no mostrar un número que no cierra.
 */
export function checkVarianceReconciliation(
  balanceGabriel: number,
  varianceLines: VarianceLine[],
  notEnteredDepositsTotal: number,
  balanceToday: number,
): { balanced: boolean; expected: number; difference: number } {
  const { variance, uncollectedDeposits } = splitVarianceLinesBySection(varianceLines);
  const expected = round(
    balanceGabriel + totalVarianceOf(variance) + totalVarianceOf(uncollectedDeposits) + notEnteredDepositsTotal,
  );
  const difference = round(balanceToday - expected);
  return { balanced: Math.abs(difference) < 0.005, expected, difference };
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

/** Nombre de proveedor normalizado para comparar: sin comas ni puntos, sin
 * mayúsculas, sin espacios de sobra -- así "Service Zone, Inc." (el PDF de
 * QuickBooks) coincide con "Service Zone Inc." (lo que se escribe a mano en
 * Configuración) y no dispara una alerta de "proveedor nuevo" por una coma. */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findUnconfiguredVendors(
  items: AgingLine[],
  config: Pick<VendorAgingConfig, "includedNames" | "excludedNames">,
): AgingLine[] {
  const excludedSet = new Set(
    config.excludedNames.map(normalizeVendorName),
  );
  const includedSet = new Set(
    config.includedNames.map(normalizeVendorName),
  );
  return items.filter(
    (item) =>
      !excludedSet.has(normalizeVendorName(item.name)) &&
      !includedSet.has(normalizeVendorName(item.name)),
  );
}

export function consolidateVendorAging(
  rawTotal: number,
  items: AgingLine[],
  config: VendorAgingConfig,
): VendorAgingResult {
  const excludedSet = new Set(
    config.excludedNames.map(normalizeVendorName),
  );
  const excludedSubtotal = sum(
    items
      .filter((item) => excludedSet.has(normalizeVendorName(item.name)))
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

// ---------------------------------------------------------------------------
// Detalle por factura del aging (Vendor/Customer Balance Detail Report)
// ---------------------------------------------------------------------------

/**
 * Una línea del aging (vendor/customer): nombre + balance (el total
 * atribuido a ese nombre, como hoy) más el detalle opcional por factura
 * (txn_date/txn_type/num/due_date/amount/open_balance) que permite
 * reproducir el PDF original agrupado con subtotal. Sin detalle
 * cargado, es exactamente el modo de hoy (un nombre, un balance).
 */
export type AgingDetailLine = {
  name: string;
  balance: number;
  txnDate: IsoDate | null;
  txnType: string | null;
  num: string | null;
  dueDate: IsoDate | null;
  amount: number | null;
  openBalance: number | null;
};

export type AgingGroup = {
  name: string;
  lines: AgingDetailLine[];
  /** Suma de open_balance por línea si hay detalle cargado, si no
   * balance -- el subtotal que va debajo de cada nombre en el PDF. */
  subtotal: number;
  /** true si alguna línea de este nombre tiene detalle por factura. */
  hasDetail: boolean;
};

/**
 * Agrupa las líneas de aging por nombre (vendor/customer) con un
 * subtotal, en el orden en que llegaron -- para reproducir el Vendor/
 * Customer Balance Detail Report original (agrupado, con subtotal por
 * nombre y total general).
 */
export function groupAgingItems(items: AgingDetailLine[]): AgingGroup[] {
  const order: string[] = [];
  const byName = new Map<string, AgingDetailLine[]>();
  for (const item of items) {
    if (!byName.has(item.name)) {
      byName.set(item.name, []);
      order.push(item.name);
    }
    byName.get(item.name)!.push(item);
  }
  return order.map((name) => {
    const lines = byName.get(name)!;
    const hasDetail = lines.some(
      (line) => line.txnDate != null || line.num != null || line.txnType != null,
    );
    const subtotal = round(
      lines.reduce((total, line) => total + (line.openBalance ?? line.balance), 0),
    );
    return { name, lines, subtotal, hasDetail };
  });
}
