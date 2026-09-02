// Verifica los criterios de aceptación del módulo de presupuesto de Tresbe
// contra la semilla real de la semana del 24 al 30 de agosto de 2026.
//
//   npx tsx scripts/test-tresbe-budget.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildHorizonSummary,
  buildWeekView,
  type CategoryLike,
  type MovementLike,
} from "../src/lib/tresbe-budget/calculations";
import { buildForecastForWeek } from "../src/lib/tresbe-budget/forecast";
import {
  addDays,
  isoWeekday,
  weekStartOf,
} from "../src/lib/tresbe-budget/dates";

const round = (value: number) => Math.round(value * 100) / 100;

const categoryDefinitions: Array<
  [string, CategoryLike["kind"], CategoryLike["total_group"], number]
> = [
  ["credit_card_disponible", "ingreso", "ingresos", 10],
  ["cash_disponible", "ingreso", "ingresos", 20],
  ["proveedores", "egreso", "proveedores_compras", 30],
  ["recurrentes", "egreso", "proveedores_compras", 40],
  ["reembolsos_mercaderia", "egreso", "proveedores_compras", 50],
  ["nomina", "egreso", "nomina", 60],
  ["payroll_taxes", "egreso", "payroll_taxes", 70],
  ["debitos_bancarios", "egreso", "debitos_bancarios", 80],
  ["linea_reserva", "financiamiento", "financiamiento", 90],
];

const categories: CategoryLike[] = categoryDefinitions.map(
  ([code, kind, total_group, sort_order]) => ({
    id: code,
    code,
    name: code,
    kind,
    total_group,
    is_financing: kind === "financiamiento",
    sort_order,
  }),
);

// Los movimientos se leen de la migración de semilla para que el test siga a los
// datos y no a una copia paralela.
const seedSql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260901010000_tresbe_budget_seed_week_20260824.sql",
  ),
  "utf8",
);
const movementsBlock = seedSql.slice(
  seedSql.indexOf("INSERT INTO tmp_seed_movements VALUES"),
  seedSql.indexOf("INSERT INTO public.tresbe_budget_movements"),
);
const movementPattern =
  /\('(\d{4}-\d{2}-\d{2})',\s*'(ingreso|egreso)',\s*'([a-z_]+)',\s*'[^']*',\s*'[^']*',\s*([\d.]+)\)/g;
const movements: MovementLike[] = [];
for (const match of movementsBlock.matchAll(movementPattern)) {
  movements.push({
    entry_date: match[1],
    direction: match[2] as "ingreso" | "egreso",
    category_id: match[3],
    amount: Number(match[4]),
  });
}
assert.equal(movements.length, 63, "la semilla debe traer 63 movimientos");

const weekStart = "2026-08-24";
assert.equal(
  weekStartOf("2026-08-27"),
  weekStart,
  "la semana arranca el lunes",
);

const view = buildWeekView({
  weekStart,
  categories,
  movements,
  entries: [],
  cashControl: {
    opening_bank_balance: 0,
    actual_bank_balance: null,
    minimum_cash_target: null,
    notes: null,
  },
});

// 1. Antes: todo ingreso caía en "Cash Disponible", barridos incluidos.
const wrongIncome = round(
  movements
    .filter((movement) => movement.direction === "ingreso")
    .reduce((sum, movement) => sum + movement.amount, 0),
);
assert.equal(
  wrongIncome,
  34185.38,
  "la suma sin corregir reproduce los ~$34,185 de la planilla",
);

// 2. Después: solo tarjeta y efectivo reales.
const cardTotal = round(
  movements
    .filter((movement) => movement.category_id === "credit_card_disponible")
    .reduce((sum, movement) => sum + movement.amount, 0),
);
const cashTotal = round(
  movements
    .filter((movement) => movement.category_id === "cash_disponible")
    .reduce((sum, movement) => sum + movement.amount, 0),
);
assert.equal(cardTotal, 12441.96, "depósitos Clover de la semana");
assert.equal(cashTotal, 9026.88, "efectivo de la semana");
assert.equal(
  view.income.totals.real,
  round(cardTotal + cashTotal),
  "Total Ingresos operativo = tarjeta + efectivo, sin barridos",
);
assert.ok(
  view.income.totals.real < wrongIncome,
  "el ingreso corregido tiene que ser menor que el inflado",
);

// 3. La línea de reserva queda fuera de los totales operativos pero visible.
const reserveIn = round(
  movements
    .filter(
      (movement) =>
        movement.category_id === "linea_reserva" &&
        movement.direction === "ingreso",
    )
    .reduce((sum, movement) => sum + movement.amount, 0),
);
const reserveOut = round(
  movements
    .filter(
      (movement) =>
        movement.category_id === "linea_reserva" &&
        movement.direction === "egreso",
    )
    .reduce((sum, movement) => sum + movement.amount, 0),
);
assert.equal(view.financing.totalInflow, reserveIn);
assert.equal(view.financing.totalOutflow, reserveOut);
assert.equal(view.financing.netReal, round(reserveIn - reserveOut));
assert.equal(
  round(wrongIncome - reserveIn),
  view.income.totals.real,
  "la diferencia entre el ingreso viejo y el nuevo es exactamente la reserva",
);
assert.ok(
  view.rows.every((row) => !row.category.is_financing),
  "las filas operativas no incluyen financiamiento",
);
assert.equal(
  view.cash.theoreticalReal,
  round(view.net.totals.real + view.financing.netReal),
  "el saldo teórico real sí incorpora la reserva para cuadrar con el banco",
);

// 4. El desvío es favorable en positivo de los dos lados.
const withBudget = buildWeekView({
  weekStart,
  categories,
  movements: [
    {
      entry_date: weekStart,
      direction: "ingreso",
      category_id: "cash_disponible",
      amount: 120,
    },
    {
      entry_date: weekStart,
      direction: "egreso",
      category_id: "proveedores",
      amount: 80,
    },
  ],
  entries: [
    {
      id: "a",
      entry_date: weekStart,
      category_id: "cash_disponible",
      amount: 100,
      origin: "calculado",
      note: null,
    },
    {
      id: "b",
      entry_date: weekStart,
      category_id: "proveedores",
      amount: 100,
      origin: "manual",
      note: null,
    },
  ],
  cashControl: null,
});
assert.equal(withBudget.income.totals.variance, 20, "ingreso por encima: +20");
assert.equal(withBudget.expenses.totals.variance, 20, "gasto por debajo: +20");
assert.equal(withBudget.net.totals.variance, 40);
assert.equal(withBudget.manualCells, 1, "las celdas manuales se cuentan");

// 5. El forecast pone el payroll tax el jueves, no el miércoles.
const forecast = buildForecastForWeek({
  weekStart,
  settings: {
    week_one_start: weekStart,
    processor_fee_rate: 0.015,
    loan_holdback_rate: 0.08,
    card_settlement_lag_days: 3,
    payroll_amount: 7857.25,
    payroll_weekday: 3,
    related_cash_out_amount: 1648.22,
    related_cash_out_enabled: false,
    payroll_tax_rate: 0.2261,
    payroll_tax_offset_days: 1,
  },
  salesPattern: [
    { weekday: 1, gross_sales: 2694.71, card_share: 0.9211 },
    { weekday: 2, gross_sales: 2128.79, card_share: 0.9211 },
    { weekday: 3, gross_sales: 2407.92, card_share: 0.9211 },
    { weekday: 4, gross_sales: 1258.55, card_share: 0.9211 },
    { weekday: 5, gross_sales: 2554.22, card_share: 0.9395 },
    { weekday: 6, gross_sales: 1984.43, card_share: 0.9124 },
    { weekday: 7, gross_sales: 19.63, card_share: 0 },
  ],
  recurringDebits: [
    {
      concept: "Préstamo Banco Popular x9001",
      category_id: "debitos_bancarios",
      amount: 553.44,
      frequency: "semanal",
      weekday: 1,
      day_of_month: null,
      weekend_shift: "ninguno",
      is_active: true,
    },
    {
      concept: "Inactivo",
      category_id: "debitos_bancarios",
      amount: 999,
      frequency: "semanal",
      weekday: 2,
      day_of_month: null,
      weekend_shift: "ninguno",
      is_active: false,
    },
  ],
  vendors: [
    {
      vendor_name: "Dockside",
      category_id: "proveedores",
      weekday: 1,
      amount: 702.19,
      is_active: true,
    },
  ],
  categoryIds: {
    creditCard: "credit_card_disponible",
    cash: "cash_disponible",
    payroll: "nomina",
    payrollTaxes: "payroll_taxes",
  },
});
const find = (categoryId: string, date: string) =>
  forecast.find(
    (entry) => entry.categoryId === categoryId && entry.entryDate === date,
  );

const payrollEntry = find("nomina", "2026-08-26");
assert.ok(payrollEntry, "la nómina va el miércoles");
assert.equal(payrollEntry!.amount, 7857.25);
assert.equal(
  find("payroll_taxes", "2026-08-26"),
  undefined,
  "el payroll tax NO puede quedar el miércoles",
);
const taxEntry = find("payroll_taxes", "2026-08-27");
assert.ok(taxEntry, "el payroll tax va el jueves");
assert.equal(isoWeekday(taxEntry!.entryDate), 4);
assert.equal(taxEntry!.amount, round(7857.25 * 0.2261));

// La tarjeta se acredita con tres días de retraso y neta de comisión/retención.
const thursdayCard = find("credit_card_disponible", "2026-08-27");
assert.ok(thursdayCard);
assert.equal(
  thursdayCard!.amount,
  round(2694.71 * 0.9211 * 0.985 * 0.92),
  "el disponible del jueves sale de la venta del lunes",
);
assert.equal(
  find("cash_disponible", weekStart)!.amount,
  round(2694.71 * (1 - 0.9211)),
  "el efectivo se acredita el mismo día",
);
assert.equal(
  find("debitos_bancarios", weekStart)!.amount,
  553.44,
  "los débitos fijos activos entran; los inactivos no",
);
assert.equal(find("debitos_bancarios", "2026-08-25"), undefined);
assert.equal(find("proveedores", weekStart)!.amount, 702.19);

// 6. El resumen de semanas se calcula de verdad, semana por semana.
const horizon = buildHorizonSummary({
  firstWeek: weekStart,
  weeks: 13,
  weekOneStart: weekStart,
  categories,
  movements,
  entries: [],
  cashControls: [],
});
assert.equal(horizon.length, 13);
assert.equal(horizon[0].weekNumber, 1);
assert.equal(horizon[0].income.real, view.income.totals.real);
assert.equal(horizon[0].hasReal, true);
assert.equal(horizon[1].weekStart, addDays(weekStart, 7));
assert.equal(horizon[1].hasReal, false, "la semana 2 no tiene datos cargados");
assert.equal(horizon[12].weekNumber, 13);

console.log("Presupuesto Tresbe: todos los criterios de aceptación pasan.");
console.log(
  `  Ingresos reales sin corregir: $${wrongIncome.toLocaleString("en-US")}`,
);
console.log(
  `  Ingresos reales corregidos:   $${view.income.totals.real.toLocaleString("en-US")}`,
);
console.log(
  `  Movimiento de línea de reserva (neto): $${view.financing.netReal.toLocaleString("en-US")}`,
);
