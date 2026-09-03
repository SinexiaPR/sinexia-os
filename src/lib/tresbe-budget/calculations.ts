// Reglas de cálculo de la vista "Seguimiento Diario" y del resumen de semanas.
//
// El módulo sigue la planilla v3, que separa cuatro tipos de movimiento:
//
//   Ingreso / Egreso  -> operativo, arma el Flujo Neto Operativo.
//   Intercompany      -> transferencias entre las LLC del grupo. No es venta ni
//                        gasto; lleva contraparte y saldo por empresa.
//   Financiamiento    -> línea de crédito, partida en Utilización y Repago, con
//                        saldo de la línea que se arrastra entre semanas.
//
// El desvío es favorable con signo positivo de los dos lados: en ingresos es
// Real − Presupuesto y en egresos, Presupuesto − Real.

import { addDays, weekDates, weekNumber, type IsoDate } from "./dates";

export type CategoryKind =
  "ingreso" | "egreso" | "financiamiento" | "intercompany";

export type CategoryLike = {
  id: string;
  code: string;
  name: string;
  kind: CategoryKind;
  total_group:
    | "ingresos"
    | "proveedores_compras"
    | "nomina"
    | "payroll_taxes"
    | "debitos_bancarios"
    | "intercompany"
    | "financiamiento";
  is_financing: boolean;
  flow?: "entrada" | "salida" | null;
  sort_order: number;
};

export type MovementLike = {
  entry_date: IsoDate;
  category_id: string;
  direction: "ingreso" | "egreso";
  amount: number;
  counterparty_id?: string | null;
  account?: string | null;
};

/** Cuenta bancaria operativa. El puente de caja (Saldo Final Banco Teórico)
 * solo debe reflejar lo que pasa por el banco -- el efectivo se rastrea
 * aparte -- igual que el SUMAR.SI.CONJUNTO de la planilla que filtra
 * Cuenta = "Banco Popular". */
export const OPERATING_BANK_ACCOUNT = "Banco Popular";

export type EntryLike = {
  id: string;
  entry_date: IsoDate;
  category_id: string;
  amount: number;
  origin: "calculado" | "manual";
  note: string | null;
};

export type CashControlLike = {
  opening_bank_balance: number;
  actual_bank_balance: number | null;
  minimum_cash_target: number | null;
  notes: string | null;
} | null;

export type CounterpartyLike = { id: string; name: string };

/** Saldos al inicio de la semana, encadenados desde el ancla del horizonte. */
export type OpeningBalances = {
  creditLine: number;
  counterparties: Record<string, number>;
};

export type Cell = {
  date: IsoDate;
  budget: number;
  real: number;
  variance: number;
  origin: "calculado" | "manual" | null;
  entryId: string | null;
  note: string | null;
};

export type Totals = { budget: number; real: number; variance: number };

export type CategoryRow = {
  category: CategoryLike;
  cells: Cell[];
  totals: Totals;
};

export type GroupRow = {
  key: string;
  label: string;
  favorable: "higher_real" | "lower_real";
  cells: Array<{
    date: IsoDate;
    budget: number;
    real: number;
    variance: number;
  }>;
  totals: Totals;
};

export type CounterpartyBalance = {
  id: string;
  name: string;
  opening: number;
  received: number;
  delivered: number;
  net: number;
  closing: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

function variance(
  favorable: "higher_real" | "lower_real",
  budget: number,
  real: number,
) {
  return round(favorable === "higher_real" ? real - budget : budget - real);
}

const groupLabels: Record<string, string> = {
  ingresos: "Total Ingresos",
  proveedores_compras: "Total Proveedores / Compras",
  nomina: "Nómina",
  payroll_taxes: "Payroll Taxes",
  debitos_bancarios: "Débitos Bancarios",
};

const expenseGroups = [
  "proveedores_compras",
  "nomina",
  "payroll_taxes",
  "debitos_bancarios",
] as const;

export const CREDIT_LINE_DRAWDOWN = "linea_credito_utilizacion";
export const CREDIT_LINE_REPAYMENT = "linea_credito_repago";
export const INTERCOMPANY_RECEIVED = "intercompany_recibido";
export const INTERCOMPANY_DELIVERED = "intercompany_entregado";

export type WeekView = ReturnType<typeof buildWeekView>;

export function buildWeekView({
  weekStart,
  categories,
  movements,
  entries,
  cashControl,
  counterparties = [],
  openings,
}: {
  weekStart: IsoDate;
  categories: CategoryLike[];
  movements: MovementLike[];
  entries: EntryLike[];
  cashControl: CashControlLike;
  counterparties?: CounterpartyLike[];
  openings?: OpeningBalances;
}) {
  const dates = weekDates(weekStart);
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const zeros = () => dates.map(() => 0);

  const realByCategory = new Map<string, number[]>();
  const budgetByCategory = new Map<string, number[]>();
  // Los tres flujos no operativos se miran por sentido: la línea entra y se
  // devuelve, y el intercompany se recibe y se entrega.
  const financingIn = zeros();
  const financingOut = zeros();
  const intercompanyIn = zeros();
  const intercompanyOut = zeros();
  const counterpartyIn = new Map<string, number>();
  const counterpartyOut = new Map<string, number>();
  // Flujo operativo restringido a Banco Popular, para el puente de caja --
  // separado del Flujo Neto Operativo de la cuadrícula (que incluye Cash/Caja).
  let bankOperatingReal = 0;

  for (const movement of movements) {
    const index = dateIndex.get(movement.entry_date);
    if (index === undefined) continue;
    const category = categoryById.get(movement.category_id);
    const amount = Number(movement.amount);
    let bucket = realByCategory.get(movement.category_id);
    if (!bucket) {
      bucket = zeros();
      realByCategory.set(movement.category_id, bucket);
    }
    bucket[index] = round(bucket[index] + amount);
    if (!category) continue;
    if (
      (category.kind === "ingreso" || category.kind === "egreso") &&
      movement.account === OPERATING_BANK_ACCOUNT
    ) {
      bankOperatingReal = round(
        bankOperatingReal + (category.kind === "ingreso" ? amount : -amount),
      );
    }
    if (category.kind === "financiamiento") {
      const target =
        category.code === CREDIT_LINE_REPAYMENT ? financingOut : financingIn;
      target[index] = round(target[index] + amount);
    } else if (category.kind === "intercompany") {
      const delivered = category.code === INTERCOMPANY_DELIVERED;
      const target = delivered ? intercompanyOut : intercompanyIn;
      target[index] = round(target[index] + amount);
      const key = movement.counterparty_id ?? "";
      const map = delivered ? counterpartyOut : counterpartyIn;
      map.set(key, round((map.get(key) ?? 0) + amount));
    }
  }

  const entryByKey = new Map<string, EntryLike>();
  for (const entry of entries) {
    entryByKey.set(`${entry.category_id}|${entry.entry_date}`, entry);
    const index = dateIndex.get(entry.entry_date);
    if (index === undefined) continue;
    let bucket = budgetByCategory.get(entry.category_id);
    if (!bucket) {
      bucket = zeros();
      budgetByCategory.set(entry.category_id, bucket);
    }
    bucket[index] = round(bucket[index] + Number(entry.amount));
  }

  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const allRows: CategoryRow[] = ordered.map((category) => {
    const operating = category.kind === "ingreso" || category.kind === "egreso";
    const favorable =
      category.kind === "ingreso" ? "higher_real" : "lower_real";
    const reals = realByCategory.get(category.id) ?? zeros();
    const cells: Cell[] = dates.map((date, index) => {
      const entry = entryByKey.get(`${category.id}|${date}`);
      const budget = entry ? Number(entry.amount) : 0;
      const real = reals[index];
      return {
        date,
        budget,
        real,
        variance: operating
          ? variance(favorable, budget, real)
          : round(real - budget),
        origin: entry ? entry.origin : null,
        entryId: entry?.id ?? null,
        note: entry?.note ?? null,
      };
    });
    const budget = round(cells.reduce((sum, cell) => sum + cell.budget, 0));
    const real = round(cells.reduce((sum, cell) => sum + cell.real, 0));
    return {
      category,
      cells,
      totals: {
        budget,
        real,
        variance: operating
          ? variance(favorable, budget, real)
          : round(real - budget),
      },
    };
  });

  const operatingRows = allRows.filter(
    (row) => row.category.kind === "ingreso" || row.category.kind === "egreso",
  );
  const intercompanyRows = allRows.filter(
    (row) => row.category.kind === "intercompany" && hasValue(row),
  );
  const financingRows = allRows.filter(
    (row) => row.category.kind === "financiamiento" && hasValue(row),
  );

  function groupRow(
    key: string,
    label: string,
    favorable: "higher_real" | "lower_real",
    members: CategoryRow[],
  ): GroupRow {
    const cells = dates.map((date, index) => {
      const budget = round(
        members.reduce((sum, row) => sum + row.cells[index].budget, 0),
      );
      const real = round(
        members.reduce((sum, row) => sum + row.cells[index].real, 0),
      );
      return {
        date,
        budget,
        real,
        variance: variance(favorable, budget, real),
      };
    });
    const budget = round(cells.reduce((sum, cell) => sum + cell.budget, 0));
    const real = round(cells.reduce((sum, cell) => sum + cell.real, 0));
    return {
      key,
      label,
      favorable,
      cells,
      totals: { budget, real, variance: variance(favorable, budget, real) },
    };
  }

  const income = groupRow(
    "ingresos",
    groupLabels.ingresos,
    "higher_real",
    operatingRows.filter((row) => row.category.total_group === "ingresos"),
  );
  const expenseSubtotals = expenseGroups.map((group) =>
    groupRow(
      group,
      groupLabels[group],
      "lower_real",
      operatingRows.filter((row) => row.category.total_group === group),
    ),
  );
  const expenses = groupRow(
    "egresos",
    "Total Egresos",
    "lower_real",
    operatingRows.filter((row) => row.category.total_group !== "ingresos"),
  );

  const netCells = dates.map((date, index) => {
    const budget = round(
      income.cells[index].budget - expenses.cells[index].budget,
    );
    const real = round(income.cells[index].real - expenses.cells[index].real);
    return { date, budget, real, variance: round(real - budget) };
  });
  const net: GroupRow = {
    key: "flujo_neto",
    label: "Flujo Neto Operativo",
    favorable: "higher_real",
    cells: netCells,
    totals: {
      budget: round(income.totals.budget - expenses.totals.budget),
      real: round(income.totals.real - expenses.totals.real),
      variance: round(
        income.totals.real -
          expenses.totals.real -
          (income.totals.budget - expenses.totals.budget),
      ),
    },
  };

  const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));
  const budgetOf = (code: string) =>
    sum(
      budgetByCategory.get(
        categories.find((item) => item.code === code)?.id ?? "",
      ) ?? [0],
    );

  const drawdown = sum(financingIn);
  const repayment = sum(financingOut);
  const financingNetReal = round(drawdown - repayment);
  const financingNetBudget = round(
    budgetOf(CREDIT_LINE_DRAWDOWN) - budgetOf(CREDIT_LINE_REPAYMENT),
  );
  const intercompanyReceived = sum(intercompanyIn);
  const intercompanyDelivered = sum(intercompanyOut);
  const intercompanyNetReal = round(
    intercompanyReceived - intercompanyDelivered,
  );
  const intercompanyNetBudget = round(
    budgetOf(INTERCOMPANY_RECEIVED) - budgetOf(INTERCOMPANY_DELIVERED),
  );

  const opening = Number(cashControl?.opening_bank_balance ?? 0);
  const actual =
    cashControl?.actual_bank_balance == null
      ? null
      : Number(cashControl.actual_bank_balance);
  const minimum =
    cashControl?.minimum_cash_target == null
      ? null
      : Number(cashControl.minimum_cash_target);

  // Puente de caja de v3: lo operativo y lo intercompany antes de tocar la
  // línea de crédito, y recién después el financiamiento.
  const beforeFinancingBudget = round(
    opening + net.totals.budget + intercompanyNetBudget,
  );
  const beforeFinancingReal = round(
    opening + bankOperatingReal + intercompanyNetReal,
  );
  const theoreticalBudget = round(beforeFinancingBudget + financingNetBudget);
  const theoreticalReal = round(beforeFinancingReal + financingNetReal);

  const creditLineOpening = openings?.creditLine ?? 0;
  const counterpartyBalances: CounterpartyBalance[] = counterparties.map(
    (counterparty) => {
      const openingBalance = openings?.counterparties[counterparty.id] ?? 0;
      const received = counterpartyIn.get(counterparty.id) ?? 0;
      const delivered = counterpartyOut.get(counterparty.id) ?? 0;
      const movementNet = round(received - delivered);
      return {
        id: counterparty.id,
        name: counterparty.name,
        opening: openingBalance,
        received,
        delivered,
        net: movementNet,
        closing: round(openingBalance + movementNet),
      };
    },
  );

  return {
    weekStart,
    dates,
    rows: operatingRows,
    intercompanyRows,
    financingRows,
    income,
    expenseSubtotals,
    expenses,
    net,
    intercompany: {
      inflow: intercompanyIn,
      outflow: intercompanyOut,
      received: intercompanyReceived,
      delivered: intercompanyDelivered,
      netReal: intercompanyNetReal,
      netBudget: intercompanyNetBudget,
      counterparties: counterpartyBalances,
    },
    financing: {
      inflow: financingIn,
      outflow: financingOut,
      drawdown,
      repayment,
      netReal: financingNetReal,
      netBudget: financingNetBudget,
      creditLineOpening,
      creditLineClosing: round(creditLineOpening + financingNetReal),
      // Compatibilidad con la vista previa a intercompany.
      totalInflow: drawdown,
      totalOutflow: repayment,
    },
    cash: {
      opening,
      actual,
      minimum,
      bankOperatingReal,
      beforeFinancingBudget,
      beforeFinancingReal,
      theoreticalBudget,
      theoreticalReal,
      differenceToReconcile:
        actual == null ? null : round(actual - theoreticalReal),
      surplusBudget:
        minimum == null ? null : round(theoreticalBudget - minimum),
      surplusReal: minimum == null ? null : round(theoreticalReal - minimum),
      notes: cashControl?.notes ?? null,
    },
    hasBudget: entries.length > 0,
    hasReal: movements.length > 0,
    manualCells: allRows.reduce(
      (count, row) =>
        count + row.cells.filter((cell) => cell.origin === "manual").length,
      0,
    ),
  };
}

function hasValue(row: CategoryRow) {
  return row.totals.real !== 0 || row.totals.budget !== 0;
}

export type HorizonRow = {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  weekNumber: number;
  income: Totals;
  expenses: Totals;
  net: Totals;
  intercompanyNetReal: number;
  financingNetReal: number;
  hasBudget: boolean;
  hasReal: boolean;
};

export function buildHorizonSummary({
  firstWeek,
  weeks,
  weekOneStart,
  categories,
  movements,
  entries,
  cashControls,
}: {
  firstWeek: IsoDate;
  weeks: number;
  weekOneStart: IsoDate;
  categories: CategoryLike[];
  movements: MovementLike[];
  entries: EntryLike[];
  cashControls: Array<{
    week_start: IsoDate;
    opening_bank_balance: number;
    actual_bank_balance: number | null;
    minimum_cash_target: number | null;
    notes: string | null;
  }>;
}): HorizonRow[] {
  const controlByWeek = new Map(
    cashControls.map((control) => [control.week_start, control]),
  );
  const rows: HorizonRow[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const weekStart = addDays(firstWeek, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const weekMovements = movements.filter(
      (movement) =>
        movement.entry_date >= weekStart && movement.entry_date <= weekEnd,
    );
    const weekEntries = entries.filter(
      (entry) => entry.entry_date >= weekStart && entry.entry_date <= weekEnd,
    );
    const view = buildWeekView({
      weekStart,
      categories,
      movements: weekMovements,
      entries: weekEntries,
      cashControl: controlByWeek.get(weekStart) ?? null,
    });
    rows.push({
      weekStart,
      weekEnd,
      weekNumber: weekNumber(weekOneStart, weekStart),
      income: view.income.totals,
      expenses: view.expenses.totals,
      net: view.net.totals,
      intercompanyNetReal: view.intercompany.netReal,
      financingNetReal: view.financing.netReal,
      hasBudget: weekEntries.length > 0,
      hasReal: weekMovements.length > 0,
    });
  }
  return rows;
}
