// Reglas de cálculo de la vista "Seguimiento Diario" y del resumen de semanas.
//
// Dos decisiones cargan todo el peso de la corrección respecto de la planilla:
//   · las categorías marcadas como financiamiento (la línea de reserva) quedan
//     fuera de Total Ingresos y Total Egresos operativos, pero entran en el
//     saldo real para que cuadre contra el banco;
//   · el desvío es favorable con signo positivo en ambos sentidos: en ingresos
//     es Real − Presupuesto y en egresos, Presupuesto − Real.

import { addDays, weekDates, weekNumber, type IsoDate } from "./dates";

export type CategoryLike = {
  id: string;
  code: string;
  name: string;
  kind: "ingreso" | "egreso" | "financiamiento";
  total_group:
    | "ingresos"
    | "proveedores_compras"
    | "nomina"
    | "payroll_taxes"
    | "debitos_bancarios"
    | "financiamiento";
  is_financing: boolean;
  sort_order: number;
};

export type MovementLike = {
  entry_date: IsoDate;
  category_id: string;
  direction: "ingreso" | "egreso";
  amount: number;
};

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

export type WeekView = ReturnType<typeof buildWeekView>;

export function buildWeekView({
  weekStart,
  categories,
  movements,
  entries,
  cashControl,
}: {
  weekStart: IsoDate;
  categories: CategoryLike[];
  movements: MovementLike[];
  entries: EntryLike[];
  cashControl: CashControlLike;
}) {
  const dates = weekDates(weekStart);
  const dateIndex = new Map(dates.map((date, index) => [date, index]));

  const realByCategory = new Map<string, number[]>();
  // La línea de reserva se mira por sentido: entra plata para cubrir cheques y
  // se devuelve con el excedente, y ambos lados deben verse por separado.
  const financingIn = dates.map(() => 0);
  const financingOut = dates.map(() => 0);
  for (const movement of movements) {
    const index = dateIndex.get(movement.entry_date);
    if (index === undefined) continue;
    let bucket = realByCategory.get(movement.category_id);
    if (!bucket) {
      bucket = dates.map(() => 0);
      realByCategory.set(movement.category_id, bucket);
    }
    bucket[index] = round(bucket[index] + Number(movement.amount));
    const category = categories.find(
      (item) => item.id === movement.category_id,
    );
    if (category?.is_financing) {
      if (movement.direction === "ingreso") {
        financingIn[index] = round(
          financingIn[index] + Number(movement.amount),
        );
      } else {
        financingOut[index] = round(
          financingOut[index] + Number(movement.amount),
        );
      }
    }
  }

  const entryByKey = new Map<string, EntryLike>();
  for (const entry of entries) {
    entryByKey.set(`${entry.category_id}|${entry.entry_date}`, entry);
  }

  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const rows: CategoryRow[] = ordered.map((category) => {
    const favorable =
      category.kind === "ingreso" ? "higher_real" : "lower_real";
    const reals = realByCategory.get(category.id) ?? dates.map(() => 0);
    const cells: Cell[] = dates.map((date, index) => {
      const entry = entryByKey.get(`${category.id}|${date}`);
      const budget = entry ? Number(entry.amount) : 0;
      const real = reals[index];
      return {
        date,
        budget,
        real,
        variance: category.is_financing
          ? round(real - budget)
          : variance(favorable, budget, real),
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
        variance: category.is_financing
          ? round(real - budget)
          : variance(favorable, budget, real),
      },
    };
  });

  const operationalRows = rows.filter((row) => !row.category.is_financing);
  const financingRows = rows.filter((row) => row.category.is_financing);

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
    operationalRows.filter((row) => row.category.total_group === "ingresos"),
  );
  const expenseSubtotals = expenseGroups.map((group) =>
    groupRow(
      group,
      groupLabels[group],
      "lower_real",
      operationalRows.filter((row) => row.category.total_group === group),
    ),
  );
  const expenses = groupRow(
    "egresos",
    "Total Egresos",
    "lower_real",
    operationalRows.filter((row) => row.category.total_group !== "ingresos"),
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
    label: "Flujo Neto",
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

  const financingNetReal = round(
    financingIn.reduce((sum, value) => sum + value, 0) -
      financingOut.reduce((sum, value) => sum + value, 0),
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
  const theoreticalBudget = round(opening + net.totals.budget);
  // El saldo real sí incorpora el movimiento de la línea de reserva: sin él, el
  // teórico nunca cuadraría contra el estado de cuenta.
  const theoreticalReal = round(opening + net.totals.real + financingNetReal);

  return {
    weekStart,
    dates,
    rows: operationalRows,
    financingRows,
    financing: {
      inflow: financingIn,
      outflow: financingOut,
      netReal: financingNetReal,
      totalInflow: round(financingIn.reduce((sum, value) => sum + value, 0)),
      totalOutflow: round(financingOut.reduce((sum, value) => sum + value, 0)),
    },
    income,
    expenseSubtotals,
    expenses,
    net,
    cash: {
      opening,
      actual,
      minimum,
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
    manualCells: rows.reduce(
      (count, row) =>
        count + row.cells.filter((cell) => cell.origin === "manual").length,
      0,
    ),
  };
}

export type HorizonRow = {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  weekNumber: number;
  income: Totals;
  expenses: Totals;
  net: Totals;
  financingNetReal: number;
  theoreticalReal: number | null;
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
      financingNetReal: view.financing.netReal,
      theoreticalReal: controlByWeek.has(weekStart)
        ? view.cash.theoreticalReal
        : null,
      hasBudget: weekEntries.length > 0,
      hasReal: weekMovements.length > 0,
    });
  }
  return rows;
}
