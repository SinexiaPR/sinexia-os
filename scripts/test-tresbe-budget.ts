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
  ["intercompany_recibido", "intercompany", "intercompany", 85],
  ["intercompany_entregado", "intercompany", "intercompany", 86],
  ["linea_credito_utilizacion", "financiamiento", "financiamiento", 90],
  ["linea_credito_repago", "financiamiento", "financiamiento", 91],
  ["aporte_dueno", "financiamiento_externo", "financiamiento_externo", 95],
  ["prestamo_dueno", "financiamiento_externo", "financiamiento_externo", 96],
  ["repago_dueno", "financiamiento_externo", "financiamiento_externo", 97],
  ["deposito_cash_banco", "transferencia_interna", "transferencia_interna", 98],
  ["retiro_banco_cash", "transferencia_interna", "transferencia_interna", 99],
];

const categories: CategoryLike[] = categoryDefinitions.map(
  ([code, kind, total_group, sort_order]) => ({
    id: code,
    code,
    name: code,
    kind,
    total_group,
    is_financing: kind === "financiamiento",
    flow:
      kind === "ingreso" || kind === "egreso"
        ? null
        : code.endsWith("_repago") ||
            code.endsWith("_entregado") ||
            code === "repago_dueno" ||
            code === "retiro_banco_cash"
          ? "salida"
          : "entrada",
    sort_order,
  }),
);

const SIBARITA = "grupo-sibarita";

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
  const direction = match[2] as "ingreso" | "egreso";
  let code = match[3];
  let counterpartyId: string | null = null;
  // Misma reclasificación que aplicó la migración a v3.
  if (code === "linea_reserva") {
    code =
      direction === "ingreso"
        ? "linea_credito_utilizacion"
        : "linea_credito_repago";
  } else if (code === "cash_disponible" && Number(match[4]) === 9000) {
    code = "intercompany_recibido";
    counterpartyId = SIBARITA;
  } else if (code === "cash_disponible" && Number(match[4]) === 26.88) {
    code = "credit_card_disponible";
  }
  movements.push({
    entry_date: match[1],
    direction,
    category_id: code,
    amount: Number(match[4]),
    counterparty_id: counterpartyId,
    // La semilla v3 carga todo bajo la misma cuenta bancaria.
    account: "Banco Popular",
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
  counterparties: [{ id: SIBARITA, name: "GRUPO SIBARITA LLC" }],
  openings: { creditLine: -23015.78, counterparties: { [SIBARITA]: 0 } },
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

// 2. Después: el operativo son solo las ventas, sin el cheque de otra LLC.
const sumOf = (code: string) =>
  round(
    movements
      .filter((movement) => movement.category_id === code)
      .reduce((sum, movement) => sum + movement.amount, 0),
  );
const cardTotal = sumOf("credit_card_disponible");
assert.equal(
  cardTotal,
  12468.84,
  "Clover + DoorDash, igual que la planilla v3",
);
assert.equal(sumOf("cash_disponible"), 0, "no queda efectivo mal clasificado");
assert.equal(
  view.income.totals.real,
  cardTotal,
  "Total Ingresos operativo = ventas, sin intercompany ni barridos",
);
assert.ok(
  view.income.totals.real < wrongIncome,
  "el ingreso corregido tiene que ser menor que el inflado",
);

// 3. Intercompany: ni venta ni gasto, con contraparte y saldo propio.
const received = sumOf("intercompany_recibido");
assert.equal(received, 9000, "el cheque de GRUPO SIBARITA");
assert.equal(view.intercompany.received, received);
assert.equal(view.intercompany.netReal, received);
assert.equal(view.intercompany.counterparties.length, 1);
assert.equal(view.intercompany.counterparties[0].received, 9000);
assert.equal(
  view.intercompany.counterparties[0].closing,
  9000,
  "saldo inicial 0 + 9,000 recibidos",
);
assert.ok(
  view.rows.every(
    (row) =>
      row.category.kind !== "intercompany" &&
      row.category.kind !== "financiamiento",
  ),
  "las filas operativas no incluyen intercompany ni financiamiento",
);

// 4. Línea de crédito: utilización y repago separados, con saldo encadenado.
const drawdown = sumOf("linea_credito_utilizacion");
const repayment = sumOf("linea_credito_repago");
assert.equal(drawdown, 12716.54, "utilización de la semana, igual que v3");
assert.equal(repayment, 8271.11);
assert.equal(view.financing.drawdown, drawdown);
assert.equal(view.financing.repayment, repayment);
assert.equal(view.financing.netReal, round(drawdown - repayment));
assert.equal(view.financing.creditLineOpening, -23015.78);
assert.equal(
  view.financing.creditLineClosing,
  round(-23015.78 + drawdown - repayment),
  "saldo final de la línea = inicial + utilización - repago",
);

// 5. El puente de caja de v3, escalón por escalón. "+ Flujo Neto Operativo"
// del puente solo mira Banco Popular (SUMAR.SI.CONJUNTO de la planilla);
// en esta semilla toda la cuenta es Banco Popular, así que coincide con el
// Flujo Neto Operativo de la cuadrícula completa.
assert.equal(
  view.cash.bankOperatingReal,
  view.net.totals.real,
  "sin movimientos en efectivo, el flujo de banco iguala al operativo total",
);
assert.equal(
  view.cash.beforeFinancingReal,
  round(view.cash.bankOperatingReal + view.intercompany.netReal),
  "el saldo antes de financiamiento suma lo operativo de banco y lo intercompany",
);
assert.equal(
  view.cash.theoreticalReal,
  round(view.cash.beforeFinancingReal + view.financing.netReal),
  "y recién después entra la línea de crédito",
);
assert.equal(
  round(wrongIncome - drawdown - received),
  view.income.totals.real,
  "el ingreso viejo era ventas + barridos + intercompany",
);

// 6. El desvío es favorable en positivo de los dos lados.
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

// 6b. Cash Disponible en cuenta "Cash / Caja" no cuenta para el puente de
// caja (Flujo Neto Operativo = SUMAR.SI.CONJUNTO filtrado a Banco Popular).
const bankVsCash = buildWeekView({
  weekStart,
  categories,
  movements: [
    {
      entry_date: weekStart,
      direction: "ingreso",
      category_id: "credit_card_disponible",
      amount: 500,
      account: "Banco Popular",
    },
    {
      entry_date: weekStart,
      direction: "ingreso",
      category_id: "cash_disponible",
      amount: 200,
      account: "Cash / Caja",
    },
    {
      entry_date: weekStart,
      direction: "egreso",
      category_id: "proveedores",
      amount: 300,
      account: "Banco Popular",
    },
  ],
  entries: [],
  cashControl: null,
});
assert.equal(
  bankVsCash.net.totals.real,
  400,
  "la cuadrícula suma banco y efectivo: 500 + 200 - 300",
);
assert.equal(
  bankVsCash.cash.bankOperatingReal,
  200,
  "el puente de caja excluye Cash / Caja: 500 - 300",
);
assert.equal(
  bankVsCash.cash.cashAccount.incomeReal,
  200,
  "+ Ingresos Operativos Cash: el título exacto de CONTROL DIARIO CASH / CAJA",
);
assert.equal(
  bankVsCash.cash.cashAccount.expenseReal,
  0,
  "- Egresos Operativos Cash: sin egresos en efectivo en este caso",
);

// 6c. Financiamiento Externo (dueño) y Transferencia Interna: filtran por
// cuenta igual que Intercompany; la transferencia mueve banco y efectivo en
// sentidos opuestos, sin filtro de cuenta propio.
const externoYTransferencias = buildWeekView({
  weekStart,
  categories,
  movements: [
    {
      entry_date: weekStart,
      direction: "ingreso",
      category_id: "aporte_dueno",
      amount: 1000,
      account: "Banco Popular",
    },
    {
      entry_date: weekStart,
      direction: "egreso",
      category_id: "repago_dueno",
      amount: 200,
      account: "Cash / Caja",
    },
    {
      entry_date: weekStart,
      direction: "ingreso",
      category_id: "deposito_cash_banco",
      amount: 150,
    },
    {
      entry_date: weekStart,
      direction: "egreso",
      category_id: "retiro_banco_cash",
      amount: 50,
    },
  ],
  entries: [],
  cashControl: { opening_bank_balance: 0, actual_bank_balance: null, minimum_cash_target: null, notes: null },
});
assert.equal(
  externoYTransferencias.financingExterno.netReal,
  800,
  "aporte 1000 - repago 200, sin filtrar por cuenta en la cuadrícula",
);
assert.equal(
  externoYTransferencias.cash.beforeFinancingReal,
  1000 + 150 - 50,
  "banco: solo el aporte (Banco Popular) + depósito - retiro",
);
assert.equal(
  externoYTransferencias.cash.cashAccount.financingExternoNetReal,
  -200,
  "cash: solo el repago (Cash / Caja)",
);
assert.equal(
  externoYTransferencias.cash.cashAccount.transferBankToCash,
  50,
  "+ Transferencias Banco → Cash: el retiro, tal como lo titula la planilla",
);
assert.equal(
  externoYTransferencias.cash.cashAccount.transferCashToBank,
  150,
  "- Depósitos Cash → Banco: el depósito, tal como lo titula la planilla",
);
assert.equal(
  externoYTransferencias.cash.cashAccount.theoreticalReal,
  -200 - 150 + 50,
  "cash: repago - depósito + retiro",
);

// 6d. CONTROL DIARIO CASH / CAJA: el saldo final de un día es el inicial del
// siguiente -- mismos importes que trajo la v5 real de la semana 1.
const dailyIncomes = [234.37, 114.65, 146.51, 173.53, 6.09, 91.14, 193.95];
const expectedClosings = [
  234.37, 349.02, 495.53, 669.06, 675.15, 766.29, 960.24,
];
const dailyCashView = buildWeekView({
  weekStart,
  categories,
  movements: dailyIncomes.map((amount, index) => ({
    entry_date: addDays(weekStart, index),
    direction: "ingreso",
    category_id: "cash_disponible",
    amount,
    account: "Cash / Caja",
  })),
  entries: [],
  cashControl: {
    opening_bank_balance: 0,
    actual_bank_balance: null,
    opening_cash_balance: 0,
    actual_cash_balance: null,
    minimum_cash_target: null,
    notes: null,
  },
});
assert.equal(dailyCashView.cash.cashAccount.days.length, 7);
dailyCashView.cash.cashAccount.days.forEach((day, index) => {
  assert.equal(
    day.closing,
    expectedClosings[index],
    `día ${index + 1}: saldo final cash teórico`,
  );
  if (index > 0) {
    assert.equal(
      day.opening,
      dailyCashView.cash.cashAccount.days[index - 1].closing,
      `día ${index + 1}: el saldo inicial es el final del día anterior`,
    );
  }
});
assert.equal(
  dailyCashView.cash.cashAccount.days[6].closing,
  dailyCashView.cash.cashAccount.theoreticalReal,
  "el último día del encadenado coincide con el saldo teórico semanal",
);

// 7. El forecast pone el payroll tax el jueves, no el miércoles.
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

// 8. El resumen de semanas se calcula de verdad, semana por semana.
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
  `  Intercompany recibido:        $${view.intercompany.netReal.toLocaleString("en-US")}`,
);
console.log(
  `  Línea de crédito (neto):      $${view.financing.netReal.toLocaleString("en-US")}`,
);
console.log(
  `  Saldo final de la línea:      $${view.financing.creditLineClosing.toLocaleString("en-US")}`,
);
