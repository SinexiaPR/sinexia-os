// Verifica el motor de cálculo de "Informes diarios" (Cut Meat
// Distributors / Wagyu Food Service LLC) contra el caso real del
// 09/10/2026 y contra los 7 días del historial ya aprobado
// (cutmeat_daily_history), al centavo, más la lógica de fechas, el
// aislamiento entre empresas y el contrato de datos (origen, bloqueo de
// días cerrados, controles de solo lectura).
//
//   npx tsx scripts/test-cutmeat-daily-reports.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  buildAgingCustomersPdf,
  buildAgingVendorsPdf,
  buildConsolidatedPdf,
  money,
} from "../src/lib/cutmeat-daily/pdf";
import { renderPdfPageToPng } from "../src/lib/cutmeat-reports/package/render";
import {
  buildBalanceAfterWeeklyPayments,
  buildBalanceGabriel,
  buildBalanceWithNotEnteredSales,
  buildFinancialReport,
  buildRecurringDetailTable,
  checkReconciliationControl,
  checkVarianceReconciliation,
  classifyBankMovements,
  consolidateCustomerAging,
  consolidateVendorAging,
  findUnconfiguredVendors,
  normalizeVendorName,
  groupAgingItems,
  overdueUnpaidRecurring,
  splitRecurringByWeek,
  splitVarianceLinesBySection,
  totalVarianceOf,
  type AgingDetailLine,
  type RecurringDetailRow,
  type RecurringPayment,
  type VarianceLine,
} from "../src/lib/cutmeat-daily/calculations";
import {
  checkDailyReportCompleteness,
} from "../src/lib/cutmeat-daily/completeness";
import {
  addDays,
  formatEnglishShortDate,
  formatSlashDate,
  isoWeekday,
  lastBusinessDayBefore,
  sundayWeekStartOf,
} from "../src/lib/cutmeat-daily/dates";

// ---------------------------------------------------------------------------
// Caso real: informe del 09/10/2026
// ---------------------------------------------------------------------------

const REPORT_DATE = "2026-10-09";

const reconciliation = checkReconciliationControl({
  statementEnding: 40107.05,
  unclearedChecks: [
    { reference: "Cheque 1004 BR Transport", amount: -125.0 },
    { reference: "Cheque 1054 Costco Wholesale", amount: -346.28 },
  ],
  unclearedDeposits: [{ reference: "ACH Jose Manzanares", amount: -500.0 }],
  register: 39135.77,
});
assert.equal(reconciliation.unclearedChecksTotal, -471.28);
assert.equal(reconciliation.unclearedDepositsTotal, -500.0);
assert.equal(reconciliation.control, 0);
assert.equal(reconciliation.balanced, true);

const recurring: RecurringPayment[] = [
  { id: "r1", concept: "Caparra Country - Gabriel Manzanares", dueDate: "2026-09-03", amount: 692, isPaid: false },
  { id: "r2", concept: "Carlos Mercado Seguros", dueDate: "2026-09-03", amount: 0, isPaid: false },
  { id: "r3", concept: "Liberty Movil", dueDate: "2026-09-15", amount: 284.39, isPaid: true, actualAmount: 257.11 },
  {
    id: "r4",
    concept: "Scotiabank - Deposito Oriental Bank - Seg de vida - J Manzanares",
    dueDate: "2026-10-01",
    amount: 350,
    isPaid: true,
    actualAmount: 500,
  },
  { id: "r5", concept: "Juan Diaz", dueDate: "2026-10-01", amount: 150, isPaid: false },
  { id: "r6", concept: "PenFed", dueDate: "2026-10-01", amount: 800, isPaid: true },
  {
    id: "r7",
    concept: "Plaza las Cumbres - Deposito - Jose Manzanares",
    dueDate: "2026-10-01",
    amount: 1200,
    isPaid: false,
  },
  { id: "r8", concept: "Caparra", dueDate: "2026-10-01", amount: 692, isPaid: false },
  { id: "r9", concept: "CCC Logistic - Storage", dueDate: "2026-10-02", amount: 95, isPaid: false },
  { id: "r10", concept: "NOMINA", dueDate: "2026-10-08", amount: 400, isPaid: false },
  { id: "r11", concept: "SS Med Jul-26 IRS", dueDate: "2026-10-09", amount: 600, isPaid: false },
  { id: "r12", concept: "Ret Jul-2026 Departamento de Hacienda", dueDate: "2026-10-09", amount: 180, isPaid: false },
  { id: "r13", concept: "SINERGIA LLC", dueDate: "2026-10-09", amount: 180, isPaid: true },
  { id: "r14", concept: "Carlos Mercado Seguros", dueDate: "2026-09-20", amount: 0, isPaid: false },
  { id: "r15", concept: "NOMINA", dueDate: "2026-10-15", amount: 400, isPaid: false },
  { id: "r16", concept: "SINERGIA", dueDate: "2026-10-16", amount: 180, isPaid: false },
];

const weekStart = sundayWeekStartOf(REPORT_DATE);
assert.equal(weekStart, "2026-10-04", "domingo de la semana del informe");

const buckets = splitRecurringByWeek(recurring, REPORT_DATE);
assert.equal(buckets.prior.total, 2829.0);
assert.equal(buckets.thisWeek.total, 1180.0);
assert.equal(buckets.nextWeek.total, 580.0);
assert.equal(buckets.weekAfter.total, 0);
assert.equal(buckets.paid.length, 4);

const weeklyPayments = buildBalanceAfterWeeklyPayments(reconciliation.register, buckets);
assert.equal(weeklyPayments.recurrentesPrior, 2829.0);
assert.equal(weeklyPayments.recurrentesThisWeek, 1180.0);
assert.equal(weeklyPayments.balanceAfterWeeklyPayments, 35126.77, "B del 09/10 (matches cutmeat_daily_history)");

// A3: ingresos de la semana en curso -- valor plano (ya no se suma por
// día ni se excluye el lunes).
const CURRENT_WEEK_INCOME = 7500;
const FLAT_WEEKLY_INCOME = 9000;

const financial = buildFinancialReport({
  reportDate: REPORT_DATE,
  balanceAfterWeeklyPayments: weeklyPayments.balanceAfterWeeklyPayments,
  currentWeekIncome: CURRENT_WEEK_INCOME,
  nextWeekBuckets: buckets.nextWeek,
  weekAfterBuckets: buckets.weekAfter,
  flatWeeklyIncome: FLAT_WEEKLY_INCOME,
});
assert.equal(financial.day7.balance, 42626.77);
assert.equal(financial.day7.date, "2026-10-12");
assert.equal(financial.day14.recurrentes, 580);
assert.equal(financial.day14.balance, 51046.77);
assert.equal(financial.day14.date, "2026-10-19");
assert.equal(financial.day21.balance, 60046.77);
assert.equal(financial.day21.date, "2026-10-26");

// A4: Variación Diaria es ahora líneas libres (concepto + monto), no
// recurrentes pagados auto-detectados -- totalVarianceOf solo suma.
const varianceLines: VarianceLine[] = [
  { concept: "Diferencia Pago Recurrentes (Liberty Movil)", amount: 27.28, section: "variance" },
  { concept: "First Bank - Service Charges", amount: -150, section: "variance" },
];
assert.equal(totalVarianceOf(varianceLines), -122.72);
assert.equal(totalVarianceOf([]), 0, "sin líneas, el total es 0");

// A6: section separa Variación Diaria de depósitos sin cobrar puntuales,
// pero el total sigue sumando ambas secciones por igual.
const mixedSectionLines: VarianceLine[] = [
  ...varianceLines,
  { concept: "The Butcher - Costco (depósito sin cobrar)", amount: 346.28, section: "uncollected_deposit" },
];
assert.equal(totalVarianceOf(mixedSectionLines), 223.56, "el total suma las 2 secciones");
const split = splitVarianceLinesBySection(mixedSectionLines);
assert.equal(split.variance.length, 2);
assert.equal(split.uncollectedDeposits.length, 1);
assert.equal(split.uncollectedDeposits[0].concept, "The Butcher - Costco (depósito sin cobrar)");

// A1: Balance GABRIEL = B del último día CERRADO anterior (no "B -
// variación"). El 08/10 cerró con B = 35,249.49 (cutmeat_daily_history).
const balanceGabriel = buildBalanceGabriel(35249.49, 0);
assert.equal(balanceGabriel, 35249.49, "Gabriel del 09/10 = B del 08/10");

const withNotEntered = buildBalanceWithNotEnteredSales(
  weeklyPayments.balanceAfterWeeklyPayments,
  [{ description: "Costco", amount: 346.28 }],
);
assert.equal(withNotEntered, 35473.05);

// D12: caso real del 10/12/2026 -- Gabriel ahora parte del balance FINAL
// del último día cerrado ("Balance after Weekly Payments + Not entered
// Sales"), no solo "Balance after Weekly Payments". El 09/10 cerró con
// withNotEntered = 35,473.05 (arriba) -- ese es el Gabriel del 10/12,
// no 35,126.77 (balance_after_weekly del 09/10 sin el depósito de
// Costco). Datos de la Variación Diaria del 10/12 ya confirmados por
// María: Recurrentes de la Semana -580.00, Aging -6,413.48, Samuel Sosa
// -1,042.40 (sección "variance" -- checks/pagos), Costco Wholesale
// -346.28 (sección "uncollected_deposit" -- reversa del Not entered
// Sales del 09/10, ya en el register). Depósitos del día 4,563.57.
const gabriel1012 = buildBalanceGabriel(withNotEntered, 0);
assert.equal(
  gabriel1012,
  35473.05,
  "Gabriel del 10/12 = Balance after Weekly Payments + Not entered Sales del 09/10 (no solo Balance after Weekly Payments)",
);
const variance1012: VarianceLine[] = [
  { concept: "Recurrentes de la Semana", amount: -580, section: "variance" },
  { concept: "Aging", amount: -6413.48, section: "variance" },
  { concept: "Samuel Sosa", amount: -1042.4, section: "variance" },
  { concept: "Costco Wholesale", amount: -346.28, section: "uncollected_deposit" },
];
const control1012 = checkVarianceReconciliation(gabriel1012, variance1012, 4563.57, 31654.46);
assert.equal(
  control1012.expected,
  31654.46,
  "Balance Today reconstruido del 10/12 = Gabriel + variación + Depósitos del día = 31,654.46",
);
assert.equal(control1012.balanced, true, "la ecuación de control cuadra con los datos reales del 10/12");
const outOfBalance1012 = checkVarianceReconciliation(gabriel1012, variance1012, 4563.57, 32000);
assert.equal(
  outOfBalance1012.balanced,
  false,
  "si Balance Today no coincide con lo reconstruido, el control detecta el movimiento sin clasificar (bloquea, no inventa un número)",
);

const vendorConfig = {
  includedNames: [
    "Mays Chemical Comp. PR Inc.",
    "Northwestern Selecta",
    "Puente Selections",
    "Quirch Foods Co.",
    "Service Zone Inc.",
  ],
  excludedNames: ["Prime Meats & Seafoods", "Jose Santiago Inc"],
  primeMeatsBalance: 914.21,
};
const vendorItems = [
  { name: "Mays Chemical Comp. PR Inc.", balance: 9000 },
  { name: "Northwestern Selecta", balance: 6000 },
  { name: "Puente Selections", balance: 4000 },
  { name: "Quirch Foods Co.", balance: 2000 },
  { name: "Service Zone Inc.", balance: 820 },
  { name: "Prime Meats & Seafoods", balance: 700 },
  { name: "Jose Santiago Inc", balance: 576.75 },
];
const vendorAging = consolidateVendorAging(23096.75, vendorItems, vendorConfig);
assert.equal(vendorAging.excludedSubtotal, 1276.75);
assert.equal(vendorAging.consolidated, 20905.79);
assert.equal(vendorAging.unconfiguredVendors.length, 0);

const vendorItemsWithUnknown = [...vendorItems, { name: "Suplidor Nuevo LLC", balance: 120 }];
assert.deepEqual(
  findUnconfiguredVendors(vendorItemsWithUnknown, vendorConfig).map((v) => v.name),
  ["Suplidor Nuevo LLC"],
);

// Normalización de nombre de proveedor: "Service Zone, Inc." (como viene
// del PDF de QuickBooks) debe coincidir con "Service Zone Inc." (como está
// en Configuración) -- sin comas, sin puntos, sin distinguir mayúsculas --
// y no disparar la alerta de "proveedor nuevo".
assert.equal(normalizeVendorName("Service Zone, Inc."), normalizeVendorName("Service Zone Inc."));
const vendorItemsWithPdfPunctuation = [
  ...vendorItems.filter((item) => item.name !== "Service Zone Inc."),
  { name: "Service Zone, Inc.", balance: 820 },
];
assert.deepEqual(
  findUnconfiguredVendors(vendorItemsWithPdfPunctuation, vendorConfig).map((v) => v.name),
  [],
  "Service Zone, Inc. (PDF) coincide con Service Zone Inc. (config) pese a la coma",
);
const vendorAgingWithPdfPunctuation = consolidateVendorAging(
  23096.75,
  vendorItemsWithPdfPunctuation,
  vendorConfig,
);
assert.equal(
  vendorAgingWithPdfPunctuation.unconfiguredVendors.length,
  0,
  "consolidateVendorAging tampoco marca Service Zone, Inc. como proveedor nuevo",
);

const customerAging = consolidateCustomerAging(16658.08);
assert.equal(customerAging.consolidated, 16658.08);

console.log(
  "Caso 09/10/2026: control de conciliación, recurrentes, Financial Report, " +
    "Variación Diaria (líneas libres), Balance GABRIEL y aging consolidados -- OK.",
);

// ---------------------------------------------------------------------------
// A1 + A2: reproducir al centavo B, Gabriel y las etiquetas 7/14/21 días
// de los 7 días del historial ya aprobado (cutmeat_daily_history) --
// encadenando Gabriel[día] = B[día anterior] (10/01 usa el valor de
// arranque 27,224.20). No depende de datos de recurrentes por día (que
// no están disponibles para los días != 09/10) -- son identidades puras
// de fecha y de la cadena B -> Gabriel.
// ---------------------------------------------------------------------------

const GABRIEL_STARTING_BALANCE = 27224.2;

const HISTORY = [
  { date: "2026-10-01", b: 27179.62, gabriel: 27224.2, day7: "2026-10-05", day14: "2026-10-12", day21: "2026-10-19" },
  { date: "2026-10-02", b: 27179.62, gabriel: 27179.62, day7: "2026-10-05", day14: "2026-10-12", day21: "2026-10-19" },
  { date: "2026-10-05", b: 35249.49, gabriel: 27179.62, day7: "2026-10-12", day14: "2026-10-19", day21: "2026-10-26" },
  { date: "2026-10-06", b: 35249.49, gabriel: 35249.49, day7: "2026-10-12", day14: "2026-10-19", day21: "2026-10-26" },
  { date: "2026-10-07", b: 35249.49, gabriel: 35249.49, day7: "2026-10-12", day14: "2026-10-19", day21: "2026-10-26" },
  { date: "2026-10-08", b: 35249.49, gabriel: 35249.49, day7: "2026-10-12", day14: "2026-10-19", day21: "2026-10-26" },
  { date: "2026-10-09", b: 35126.77, gabriel: 35249.49, day7: "2026-10-12", day14: "2026-10-19", day21: "2026-10-26" },
];

for (let i = 0; i < HISTORY.length; i++) {
  const row = HISTORY[i]!;
  const previousB = i === 0 ? null : HISTORY[i - 1]!.b;
  const gabriel = buildBalanceGabriel(previousB, GABRIEL_STARTING_BALANCE);
  assert.equal(gabriel, row.gabriel, `Gabriel[${row.date}] = B del día anterior (o arranque el 10/01)`);

  const labels = buildFinancialReport({
    reportDate: row.date,
    balanceAfterWeeklyPayments: 0,
    currentWeekIncome: 0,
    nextWeekBuckets: { total: 0 },
    weekAfterBuckets: { total: 0 },
  });
  assert.equal(labels.day7.date, row.day7, `etiqueta 7-day de ${row.date}`);
  assert.equal(labels.day14.date, row.day14, `etiqueta 14-day de ${row.date}`);
  assert.equal(labels.day21.date, row.day21, `etiqueta 21-day de ${row.date}`);
}
// Caso del ejemplo dado: informe 10/06 -> sábado 10/10 -> 10/12, 10/19, 10/26.
assert.equal(HISTORY[3]!.date, "2026-10-06");
assert.equal(HISTORY[3]!.day7, "2026-10-12");
assert.equal(HISTORY[3]!.day14, "2026-10-19");
assert.equal(HISTORY[3]!.day21, "2026-10-26");

console.log(
  "Historial 01/10-09/10/2026: Balance GABRIEL encadenado al B del día " +
    "anterior (arranque 27,224.20 el 10/01) y etiquetas 7/14/21 días " +
    "(sábado de la semana + 2/9/16) -- OK, 7 días.",
);

// ---------------------------------------------------------------------------
// Movimientos del banco sin clasificar
// ---------------------------------------------------------------------------

const movementClassification = classifyBankMovements([
  { id: "m1", description: "Deposito Costco", amount: 346.28, direction: "ingreso", isNotEnteredDeposit: true },
  { id: "m2", description: "ACH Liberty Movil", amount: 257.11, direction: "egreso", linkedRecurringId: "r3" },
  { id: "m3", description: "ACH desconocido XYZ", amount: 88.4, direction: "egreso" },
]);
assert.equal(movementClassification.unclassified.length, 1);
assert.equal(movementClassification.unclassified[0]?.id, "m3");
assert.equal(movementClassification.notEnteredDeposits.length, 1);
assert.equal(movementClassification.classified.length, 1);

assert.deepEqual(
  overdueUnpaidRecurring(recurring, REPORT_DATE).map((item) => item.id).sort(),
  ["r1", "r10", "r11", "r12", "r14", "r2", "r5", "r7", "r8", "r9"].sort(),
);

const completenessWarnings = checkDailyReportCompleteness({
  reportDate: REPORT_DATE,
  reconciliationControl: reconciliation,
  bankMovements: [{ id: "m3", description: "ACH desconocido XYZ", amount: 88.4, direction: "egreso" }],
  recurring,
  vendorAgingItems: vendorItemsWithUnknown,
  vendorAgingConfig: vendorConfig,
  sources: { hasReconciliation: true, hasBankExport: true, hasVendorAging: true, hasCustomerAging: true },
  varianceReconciliation: null,
});
assert.ok(
  completenessWarnings.some((w) => w.severity === "blocking" && w.message.includes("sin clasificar")),
  "movimiento sin clasificar bloquea",
);
assert.ok(
  completenessWarnings.some(
    (w) => w.severity === "blocking" && w.message.includes("Suplidor Nuevo LLC"),
  ),
  "proveedor nuevo sin configurar bloquea",
);
assert.ok(
  completenessWarnings.some(
    (w) => w.severity === "info" && w.message.includes("Recurrente vencido"),
  ),
  "recurrente vencido sin pago es informativo (el bucket normal Prior + This week, no bloquea)",
);

console.log("Alertas de completitud (sin clasificar, vencidos, proveedor nuevo): OK.");

// ---------------------------------------------------------------------------
// C: aging con detalle por factura -- agrupado por nombre, con subtotal.
// ---------------------------------------------------------------------------

const detailLines: AgingDetailLine[] = [
  {
    name: "Acme Corp",
    balance: 60,
    txnDate: "2026-09-01",
    txnType: "Invoice",
    num: "INV-001",
    dueDate: "2026-09-15",
    amount: 60,
    openBalance: 60,
  },
  {
    name: "Acme Corp",
    balance: 40,
    txnDate: "2026-09-10",
    txnType: "Invoice",
    num: "INV-002",
    dueDate: "2026-09-25",
    amount: 40,
    openBalance: 40,
  },
  {
    name: "Beta LLC",
    balance: 25,
    txnDate: "2026-09-05",
    txnType: "Bill",
    num: "B-900",
    dueDate: "2026-09-20",
    amount: 25,
    openBalance: 25,
  },
];
const detailGroups = groupAgingItems(detailLines);
assert.equal(detailGroups.length, 2, "dos nombres (Acme Corp, Beta LLC)");
assert.equal(detailGroups[0]?.subtotal, 100, "Acme Corp: 60 + 40");
assert.equal(detailGroups[0]?.hasDetail, true);
assert.equal(detailGroups[1]?.subtotal, 25, "Beta LLC");

// Sin detalle cargado (solo nombre + balance), hasDetail es false --
// sigue funcionando exactamente como hoy (un nombre, un balance).
const simpleGroups = groupAgingItems([
  { name: "Solo Total SA", balance: 500, txnDate: null, txnType: null, num: null, dueDate: null, amount: null, openBalance: null },
]);
assert.equal(simpleGroups[0]?.hasDetail, false);
assert.equal(simpleGroups[0]?.subtotal, 500, "sin detalle, el subtotal es el balance");

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  await import("@napi-rs/canvas");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } finally {
    await parser.destroy?.();
  }
}

type PositionedTextItem = { str: string; x: number; y: number; width: number };

/**
 * Posición real de cada fragmento de texto de una página (vía
 * pdfjs-dist, no pdf-parse) -- para detectar colisiones visuales que el
 * texto extraído no revela (dos textos se pueden superponer en el PDF y
 * seguir extrayéndose bien como texto plano).
 */
async function extractPdfTextPositions(
  bytes: Uint8Array,
  pageNumber: number,
): Promise<PositionedTextItem[]> {
  await import("@napi-rs/canvas");
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items
      .filter((item) => "str" in item && "transform" in item && item.str.trim().length > 0)
      .map((item) => {
        const textItem = item as { str: string; transform: number[]; width: number };
        return { str: textItem.str, x: textItem.transform[4], y: textItem.transform[5], width: textItem.width };
      });
  } finally {
    await doc.destroy();
  }
}

/** Dos fragmentos "colisionan" si están en la misma línea (y parecido) y
 * sus rangos horizontales se superponen -- exactamente lo que le pasó a
 * "Aging Vendors (consolidado...)" y "Excluidos (...)" en la portada del
 * Paquete para el dueño antes de este fix. */
function assertNoHorizontalOverlap(
  items: PositionedTextItem[],
  startsWithA: string,
  startsWithB: string,
  message: string,
) {
  const a = items.find((item) => item.str.startsWith(startsWithA));
  const b = items.find((item) => item.str.startsWith(startsWithB));
  assert.ok(a, `no se encontró el texto "${startsWithA}"`);
  assert.ok(b, `no se encontró el texto "${startsWithB}"`);
  if (Math.abs(a!.y - b!.y) < 3) {
    assert.ok(a!.x + a!.width <= b!.x + 0.5, message);
  }
}

// ---------------------------------------------------------------------------
// Aging real del 09/10/2026 (24 líneas de proveedores, 22 de clientes,
// con detalle por factura) -- paginación y total general de
// buildAgingVendorsPdf/buildAgingCustomersPdf contra el PDF que de verdad
// se entrega. Hernan entrega Aging Vendors en 1 página y Aging Customers
// en 2; esto verifica que el PDF generado haga lo mismo con estos datos
// (no se corte, con el total general visible) en vez de solo revisar el
// cálculo puro. El Paquete para el dueño (buildAndStorePackage, vía
// generateDailyPdf) copia este mismo PDF tal cual al armar el paquete
// -- no lo reconstruye con otra lógica -- así que este test también
// cubre lo que termina viendo el dueño.
// ---------------------------------------------------------------------------

function detailLine(
  name: string,
  balance: number,
  txnDate: string,
  txnType: string,
  num: string,
  dueDate: string,
): AgingDetailLine {
  return { name, balance, txnDate: txnDate as never, txnType, num, dueDate: dueDate as never, amount: balance, openBalance: balance };
}

const realVendorLines1009: AgingDetailLine[] = [
  detailLine("MAYS CHEMICAL COMP. PR INC.", 171.16, "2026-09-07", "Bill", "170315", "2026-10-07"),
  detailLine("NORTHWESTERN SELECTA", 1637.22, "2026-09-08", "Bill", "4146373", "2026-09-15"),
  detailLine("NORTHWESTERN SELECTA", 1444.11, "2026-09-09", "Bill", "4147526", "2026-09-16"),
  detailLine("NORTHWESTERN SELECTA", 786.21, "2026-09-10", "Bill", "4148368", "2026-09-17"),
  detailLine("NORTHWESTERN SELECTA", 167.10, "2026-09-11", "Bill", "4149416", "2026-09-18"),
  detailLine("NORTHWESTERN SELECTA", 386.86, "2026-09-30", "Bill", "4161273", "2026-10-07"),
  detailLine("PUENTE SELECTIONS", 151.25, "2026-09-11", "Bill", "21751", "2026-10-02"),
  detailLine("QUIRCH FOODS CO.", 1096.50, "2026-09-08", "Bill", "14647309", "2026-10-08"),
  detailLine("QUIRCH FOODS CO.", 915.92, "2026-09-09", "Bill", "14651351", "2026-10-09"),
  detailLine("QUIRCH FOODS CO.", 915.92, "2026-09-10", "Bill", "14654880", "2026-10-10"),
  detailLine("QUIRCH FOODS CO.", 312.06, "2026-09-11", "Bill", "14658946", "2026-10-11"),
  detailLine("QUIRCH FOODS CO.", 47.03, "2026-09-11", "Bill", "14659161", "2026-10-11"),
  detailLine("QUIRCH FOODS CO.", 1428.34, "2026-09-17", "Bill", "14675310", "2026-10-17"),
  detailLine("QUIRCH FOODS CO.", 2263.74, "2026-09-18", "Bill", "14678674", "2026-10-18"),
  detailLine("QUIRCH FOODS CO.", 442.00, "2026-09-21", "Bill", "14683237", "2026-10-21"),
  detailLine("QUIRCH FOODS CO.", 1974.41, "2026-09-23", "Bill", "14690855", "2026-10-23"),
  detailLine("QUIRCH FOODS CO.", 3216.15, "2026-09-25", "Bill", "14698378", "2026-10-25"),
  detailLine("QUIRCH FOODS CO.", 697.70, "2026-09-30", "Bill", "14711299", "2026-10-30"),
  detailLine("QUIRCH FOODS CO.", 1669.48, "2026-10-02", "Bill", "14718130", "2026-11-01"),
  detailLine("QUIRCH FOODS CO.", 509.30, "2026-10-05", "Bill", "14723127", "2026-11-04"),
  detailLine("Service Zone, Inc.", 252.21, "2026-09-12", "Bill", "G26-09-0908", "2026-09-12"),
  detailLine("Service Zone, Inc.", 159.14, "2026-09-19", "Bill", "G26-09-0936", "2026-09-19"),
  detailLine("Service Zone, Inc.", 169.58, "2026-09-26", "Bill", "G26-09-0962", "2026-09-26"),
  detailLine("Service Zone, Inc.", 92.40, "2026-10-03", "Bill", "G26-10-0987", "2026-10-03"),
];
assert.equal(realVendorLines1009.length, 24, "24 líneas de aging de proveedores del 09/10");
const realVendorRawTotal1009 = Math.round(
  realVendorLines1009.reduce((total, line) => total + line.balance, 0) * 100,
) / 100;
assert.equal(realVendorRawTotal1009, 20905.79);

const realCustomerLines1009: AgingDetailLine[] = [
  detailLine("ANTONIOS REST.", 694.13, "2026-09-23", "Invoice", "0729", "2026-10-14"),
  detailLine("BARDOT REST.", 433.58, "2026-08-28", "Invoice", "0698", "2026-09-18"),
  detailLine("CASA MANOLO", 319.35, "2026-09-11", "Invoice", "0718", "2026-10-02"),
  detailLine("EL CHOTIS", 763.17, "2026-09-02", "Invoice", "0702", "2026-09-23"),
  detailLine("EL CHOTIS", 699.56, "2026-09-16", "Invoice", "0722", "2026-10-07"),
  detailLine("EL CHOTIS", 737.15, "2026-09-30", "Invoice", "0740", "2026-10-21"),
  detailLine("EL RODABALLO REST.", 1663.65, "2026-09-23", "Invoice", "0728", "2026-10-14"),
  detailLine("KIMPO GARDEN", 542.07, "2026-09-21", "Invoice", "0726", "2026-10-12"),
  detailLine("LA BRAZA SMOKE HOUSE", 1257.33, "2026-08-21", "Invoice", "0686", "2026-09-11"),
  detailLine("LA BRAZA SMOKE HOUSE", 747.78, "2026-10-02", "Invoice", "0743", "2026-10-23"),
  detailLine("MARMALADE CORP", 1885.22, "2026-09-25", "Invoice", "0733", "2026-10-16"),
  detailLine("PAULINA ESCANES", 444.00, "2026-09-25", "Invoice", "0735", "2026-10-25"),
  detailLine("PAULINA ESCANES", 444.00, "2026-10-02", "Invoice", "0742", "2026-11-01"),
  detailLine("RARE 125 REST", 819.77, "2026-09-02", "Invoice", "0699", "2026-09-23"),
  detailLine("REST. MIRAFLORES 19", 1549.28, "2026-07-02", "Invoice", "0588", "2026-07-23"),
  detailLine("SABORES GOURMET", 885.85, "2026-09-10", "Invoice", "0715", "2026-10-01"),
  detailLine("SABORES GOURMET", 1007.37, "2026-09-25", "Invoice", "0734", "2026-10-16"),
  detailLine("SUR BARRA NIKKEI REST.", 548.44, "2026-08-26", "Invoice", "0693", "2026-09-16"),
  detailLine("SUR BARRA NIKKEI REST.", 265.52, "2026-09-02", "Invoice", "0701", "2026-09-23"),
  detailLine("SUR BARRA NIKKEI REST.", 541.29, "2026-09-23", "Invoice", "0730", "2026-10-14"),
  detailLine("TIJUANA'S SAN PATRICIO", 137.17, "2026-08-20", "Invoice", "0681", "2026-09-10"),
  detailLine("TIJUANAS'S VIEJO SAN JUAN", 272.40, "2026-08-20", "Invoice", "0680", "2026-09-10"),
];
assert.equal(realCustomerLines1009.length, 22, "22 líneas de aging de clientes del 09/10");
const realCustomerRawTotal1009 = Math.round(
  realCustomerLines1009.reduce((total, line) => total + line.balance, 0) * 100,
) / 100;
assert.equal(realCustomerRawTotal1009, 16658.08);

async function main() {
  const realVendorPdf = await buildAgingVendorsPdf({
    reportDate: REPORT_DATE,
    items: realVendorLines1009,
    rawTotal: realVendorRawTotal1009,
    groups: groupAgingItems(realVendorLines1009),
  });
  const realVendorText = await extractPdfText(realVendorPdf);
  assert.ok(
    realVendorText.includes(`TOTAL ${money(20905.79)}`),
    "Aging Vendors del 09/10: TOTAL visible y correcto ($20,905.79), etiqueta \"TOTAL\" (no \"Total general\")",
  );
  assert.ok(
    realVendorText.includes("-- 1 of 1 --"),
    "Aging Vendors del 09/10 entra en 1 página, igual que la planilla de Hernan",
  );
  assert.ok(
    realVendorText.includes("Wagyu Food Service LLC") && realVendorText.includes("Vendor Balance Detail Report - New"),
    "título exacto del Vendor Balance Detail Report (sin SINEXIA/Fecha del informe)",
  );
  assert.ok(!realVendorText.includes("SINEXIA"), "sin el banner SINEXIA");
  assert.ok(realVendorText.includes("1/1"), "pie de página con paginación 1/1");

  const realCustomerPdf = await buildAgingCustomersPdf({
    reportDate: REPORT_DATE,
    items: realCustomerLines1009,
    rawTotal: realCustomerRawTotal1009,
    groups: groupAgingItems(realCustomerLines1009),
  });
  const realCustomerText = await extractPdfText(realCustomerPdf);
  assert.ok(
    realCustomerText.includes(`TOTAL ${money(16658.08)}`),
    "Aging Customers del 09/10: TOTAL visible y correcto ($16,658.08), etiqueta \"TOTAL\" (no \"Total general\")",
  );
  assert.ok(
    realCustomerText.includes("-- 2 of 2 --") && !realCustomerText.includes("-- 3 of"),
    "Aging Customers del 09/10 entra en 2 páginas, igual que la planilla de Hernan",
  );
  assert.ok(
    realCustomerText.includes("Customer Balance Detail Report - New") &&
      realCustomerText.includes(`As of ${formatEnglishShortDate(REPORT_DATE)}`),
    "título exacto del Customer Balance Detail Report, con \"As of <fecha>\"",
  );
  assert.ok(realCustomerText.includes("2/2"), "pie de página con paginación 2/2");

  console.log(
    "Aging real del 09/10 (24 proveedores, 22 clientes): paginación y total " +
      "general del PDF generado -- OK.",
  );

  // Datos reales de cutmeat_recurrentes para el 09/10/2026 (consultados
  // directamente en Supabase, proyecto lrlzqgkfalbuunkixdbd, período
  // 2026-10-01) -- incluye los 2 "Carlos Mercado Seguros" sin fecha ($0,
  // no afectan ningún total) y los 4 pagados (gris) que Hernan muestra
  // pero no suma: Liberty Movil 284.39, ACH Scotiabank 350.00, ACH
  // PenFed 800.00, SINERGIA LLC 180.00 (09/10).
  const realRecurring1009: RecurringDetailRow[] = [
    { entryDate: "2026-09-03", itemType: "Bill", referenceNumber: null, vendor: "Caparra Country - Gabriel Manzanares", dueDate: "2026-09-03", amount: 692, isPaid: false },
    { entryDate: "2026-10-01", itemType: "ACH", referenceNumber: "3004592793 Plaza las Cumbres", vendor: "Deposito - Jose Manzanares", dueDate: "2026-10-01", amount: 1200, isPaid: false },
    { entryDate: "2026-10-01", itemType: "Bill", referenceNumber: null, vendor: "Caparra Country - Gabriel Manzanares", dueDate: "2026-10-01", amount: 692, isPaid: false },
    { entryDate: "2026-10-01", itemType: "ACH", referenceNumber: "1755670185 Scotiabank", vendor: "Deposito Oriental Bank - Seg de vida - J Manzanares", dueDate: "2026-10-01", amount: 350, isPaid: true },
    { entryDate: "2026-10-01", itemType: "Bill", referenceNumber: null, vendor: "Juan Diaz", dueDate: "2026-10-01", amount: 150, isPaid: false },
    { entryDate: "2026-10-01", itemType: "ACH", referenceNumber: "724492-5025 PenFed", vendor: "PenFed - Jose Manzanares", dueDate: "2026-10-01", amount: 800, isPaid: true },
    { entryDate: "2026-10-02", itemType: "Bill", referenceNumber: null, vendor: "CCC Logistic - Storage", dueDate: "2026-10-02", amount: 95, isPaid: false },
    { entryDate: "2026-10-08", itemType: "Bill", referenceNumber: null, vendor: "NOMINA", dueDate: "2026-10-08", amount: 400, isPaid: false },
    { entryDate: "2026-09-30", itemType: "Bill", referenceNumber: "\"SS Med Jul-26\"", vendor: "Internal Revenue Service", dueDate: "2026-10-09", amount: 600, isPaid: false },
    { entryDate: "2026-09-30", itemType: "Bill", referenceNumber: "\"Ret Jul-2026\"", vendor: "Departamento de Hacienda", dueDate: "2026-10-09", amount: 180, isPaid: false },
    { entryDate: "2026-10-09", itemType: "Bill", referenceNumber: null, vendor: "SINERGIA LLC", dueDate: "2026-10-09", amount: 180, isPaid: true },
    { entryDate: "2026-10-15", itemType: "Bill", referenceNumber: null, vendor: "NOMINA", dueDate: "2026-10-15", amount: 400, isPaid: false },
    { entryDate: "2026-10-16", itemType: "Bill", referenceNumber: null, vendor: "SINERGIA LLC", dueDate: "2026-10-16", amount: 180, isPaid: false },
    { entryDate: null, itemType: null, referenceNumber: null, vendor: "Carlos Mercado Seguros", dueDate: null, amount: 0, isPaid: false },
    { entryDate: null, itemType: null, referenceNumber: null, vendor: "Carlos Mercado Seguros", dueDate: null, amount: 0, isPaid: false },
  ];
  const realRecurringTable1009 = buildRecurringDetailTable(realRecurring1009, REPORT_DATE);
  assert.equal(realRecurringTable1009.prior.total, 2829, "A/P Aging Detail Recurrentes: Total-Week (prior) = 2,829.00, igual que Hernan");
  assert.equal(realRecurringTable1009.thisWeek.total, 1180, "Total-Week (this week) = 1,180.00, igual que Hernan");
  assert.equal(realRecurringTable1009.nextWeek.total, 580, "Total-Week (next week) = 580.00, igual que Hernan");
  assert.equal(realRecurringTable1009.grandTotal, 4589, "TOTAL RECURRENTES A PAGAR = 4,589.00, igual que Hernan");
  // Orden de las 2 filas "Carlos Mercado Seguros" (sin vencimiento, $0):
  // una cerca del principio de "prior" (después de Caparra 9/3, como en
  // el original de Hernan) y la otra al principio de "nextWeek" (antes
  // de NOMINA 10/15) -- no las dos juntas en "prior".
  assert.equal(realRecurringTable1009.prior.rows[1]?.vendor, "Carlos Mercado Seguros", "1er Carlos Mercado Seguros justo después de la primera fila de prior");
  assert.equal(realRecurringTable1009.nextWeek.rows[0]?.vendor, "Carlos Mercado Seguros", "2do Carlos Mercado Seguros al principio de nextWeek");
  console.log("A/P Aging Detail Recurrentes del 09/10 (datos reales de cutmeat_recurrentes): Total-Week por semana, total general y orden de filas (Carlos Mercado Seguros) -- OK.");

  // Paquete para el dueño del 09/10: Consolidated real de 3 páginas
  // (RECONCILIATION INFORMATION + FINANCIAL REPORT / A/P Aging Detail
  // Recurrentes -- Balance GABRIEL + Variación Diaria -- portada
  // CONSOLIDATED REPORT), con los datos reales de esta sesión (la línea
  // de Costco en variance_lines se borró en una tarea anterior -- el
  // 09/10 real no tiene ninguna línea "uncollected_deposit"; Costco solo
  // es un bank movement is_not_entered_deposit). El bug de Costco (ver
  // services/cutmeat-daily.ts) hacía que "Variación Diaria (total)"
  // mostrara 223.56 en vez de -122.72 por sumar lo que hubiera en
  // uncollected_deposit junto con la variación propiamente dicha
  // (variance) -- acá se verifica la cadena completa: Balance GABRIEL
  // (35,249.49) + variación (-122.72) = 35,126.77 ("Balance after Weekly
  // Payments" de la página 2, que tiene que coincidir con el Balance
  // Today calculado del Register -- esa coincidencia ES el control) +
  // Depósitos del día (346.28, el bank movement de Costco) = 35,473.05.
  const realVarianceLines1009: VarianceLine[] = [
    { concept: "Jose Manzanares - Diferencia Recurrentes", amount: -150, section: "variance" },
    { concept: "Diferencia Pago Recurrentes (Liberty)", amount: 27.28, section: "variance" },
  ];
  const consolidatedPdf = await buildConsolidatedPdf({
    reportDate: REPORT_DATE,
    control: reconciliation,
    financial,
    recurring: realRecurring1009,
    varianceLines: realVarianceLines1009,
    balanceGabriel: 35249.49,
    notEnteredDepositsTotal: 346.28,
    vendorAging,
    customerAgingRawTotal: 16658.08,
    customerAgingConsolidated: 16658.08,
    primeMeatsRecurring: 0,
  });
  assert.ok(consolidatedPdf.length > 0, "el Consolidated del 09/10 no está vacío");
  const page1Text = await extractPdfText(consolidatedPdf);
  assert.ok(page1Text.includes("RECONCILIATION INFORMATION"), "título corregido (INFORM -> INFORMATION)");
  assert.ok(page1Text.includes("Aging at"), "título corregido (Agin -> Aging)");
  assert.ok(!page1Text.includes("del del"), "sin el \"del del\" duplicado (Recurrentes/Aging for next weeks)");
  assert.ok(page1Text.includes("Departamento de Hacienda"), "título corregido (Departameno -> Departamento)");
  assert.ok(page1Text.includes(`Total-Week ${money(2829)}`), "A/P Aging Detail Recurrentes: Total-Week prior visible");
  assert.ok(page1Text.includes(`TOTAL RECURRENTES A PAGAR ${money(4589)}`), "A/P Aging Detail Recurrentes: total general visible");

  // Bug reportado por María: las etiquetas largas de FINANCIAL REPORT
  // ("Weekly income projection - Proyección del...") invadían la
  // columna de montos y se superponían con "$7,500.00" -- labelValueRow
  // ahora las envuelve en su propia columna de ancho fijo. Se verifica
  // por posición real del texto (pdfjs), no solo que el texto esté
  // presente.
  const page1Items = await extractPdfTextPositions(consolidatedPdf, 1);
  assertNoHorizontalOverlap(
    page1Items,
    "Weekly income projection",
    money(7500),
    "\"Weekly income projection...\" no debe superponerse con $7,500.00",
  );
  assertNoHorizontalOverlap(
    page1Items,
    "Uncleared deposits and other credits as of",
    money(-500),
    "\"Uncleared deposits and other credits as of...\" no debe superponerse con su valor",
  );
  console.log("FINANCIAL REPORT / RECONCILIATION INFORMATION: etiquetas largas sin superponerse con su valor -- OK.");

  const page2Text = await extractPdfText(consolidatedPdf);
  assert.ok(page2Text.includes("Variación Diaria"), "título corregido (Variacion -> Variación)");
  assert.ok(
    page2Text.includes(`Balance after Weekly Payments ${money(35126.77)}`),
    "Balance after Weekly Payments (pág. 2) = Gabriel + variación = 35,126.77 (bug de Costco corregido, no 223.56 de variación) -- coincide con el Balance Today del Register, que ES el control",
  );
  assert.ok(
    page2Text.includes(`Depósitos ${formatSlashDate(REPORT_DATE)} ${money(346.28)}`),
    "título corregido (Depositos -> Depósitos); Depósitos del día = notEnteredDepositsTotal = 346.28 (el bank movement de Costco, sin netear contra nada)",
  );
  assert.ok(
    page2Text.includes(`Balance after Weekly Payments + Not entered Sales ${money(35473.05)}`),
    "Balance after Weekly Payments + Not entered Sales = 35,126.77 + 346.28 = 35,473.05",
  );

  const page3Items = await extractPdfTextPositions(consolidatedPdf, 3);
  const page3Text = page3Items.map((item) => item.str).join(" ");
  assert.ok(page3Text.includes("CONSOLIDATED REPORT"), "título de la portada preservado tal cual (mayúsculas)");
  assert.ok(!page3Text.includes("SINEXIA"), "la portada no tiene el banner SINEXIA que Hernan no tiene");
  assert.ok(!page3Text.includes("Fecha del informe"), "la portada no tiene \"Fecha del informe\" -- Hernan no lo tiene");
  assert.ok(!page3Text.includes("raw total"), "la portada no tiene \"Aging Vendors (raw total)\" -- ya no existe");
  assert.ok(!page3Text.includes("Excluidos"), "la portada no tiene \"Excluidos (...)\" -- ya no existe");
  assert.ok(page3Text.includes("Total First Bank Accounts"), "etiqueta de portada exacta (resaltada)");
  assert.ok(page3Text.includes("Aging Vendors - Consolidated Total"), "etiqueta de portada exacta (resaltada)");
  assert.ok(page3Text.includes("Aging Customers - Consolidated Total"), "etiqueta de portada exacta (resaltada)");
  assertNoHorizontalOverlap(
    page3Items,
    "Total First Bank Accounts",
    money(financial!.balanceToday),
    "\"Total First Bank Accounts\" no debe superponerse con su valor",
  );
  console.log(
    "Paquete del 09/10 (Consolidated real, 3 páginas): títulos corregidos, sin banners de más, " +
      "bug de Costco en Variación Diaria corregido (35,473.05, no 223.56/35,596.05) -- OK.",
  );

  // buildAndStorePackage reusa los mismos bytes del PDF del paquete
  // para renderizar la portada (renderPdfPageToPng) y para subirlos a
  // Storage. pdfjs-dist manda el ArrayBuffer de `data` como
  // transferable al worker (GetDocRequest en pdf.mjs) incluso en Node
  // (el "fake worker" pasa por el mismo postMessage con transfer
  // list) -- eso DEJA EN 0 BYTES el Uint8Array original apenas
  // getDocument() lo recibe. Sin el .slice() defensivo en
  // renderPdfPageToPng, el PDF subido a Storage después de renderizar
  // la portada queda vacío (confirmado en producción: el archivo
  // quedó con size:0 en storage.objects tras generar el paquete real
  // del 09/10). Este test reproduce exactamente eso: los bytes que SE
  // LE PASAN a renderPdfPageToPng tienen que seguir intactos después.
  const consolidatedPdfLengthBefore = consolidatedPdf.length;
  assert.ok(consolidatedPdfLengthBefore > 0, "el PDF de prueba no está vacío antes de renderizar");
  await renderPdfPageToPng(consolidatedPdf, 1, 400);
  assert.equal(
    consolidatedPdf.length,
    consolidatedPdfLengthBefore,
    "renderPdfPageToPng no debe vaciar/destruir los bytes del PDF que recibió " +
      "(pdfjs-dist transfiere el ArrayBuffer al worker si no se le pasa una copia)",
  );
  console.log("renderPdfPageToPng no destruye el buffer de entrada (bug del 09/10 en producción) -- OK.");

  const withDetailPdf = await buildAgingVendorsPdf({
    reportDate: REPORT_DATE,
    items: detailLines,
    rawTotal: 125,
    groups: detailGroups,
  });
  const withDetailText = await extractPdfText(withDetailPdf);
  assert.ok(withDetailText.includes("Acme Corp"), "el PDF agrupa por nombre");
  assert.ok(withDetailText.includes("INV-001") && withDetailText.includes("INV-002"), "detalle por factura");
  assert.ok(withDetailText.includes("Total for Acme Corp"), "subtotal por nombre");
  assert.ok(withDetailText.includes(money(125)), "total general");

  const withoutDetailPdf = await buildAgingVendorsPdf({
    reportDate: REPORT_DATE,
    items: vendorItems,
    rawTotal: 23096.75,
    groups: groupAgingItems(
      vendorItems.map((item) => ({
        ...item,
        txnDate: null,
        txnType: null,
        num: null,
        dueDate: null,
        amount: null,
        openBalance: null,
      })),
    ),
  });
  const withoutDetailText = await extractPdfText(withoutDetailPdf);
  assert.ok(
    !withoutDetailText.includes("Total for"),
    "sin detalle cargado, el PDF sigue siendo el formato simple (nombre + balance), no el agrupado",
  );

  console.log(
    "Aging con detalle por factura: PDF agrupado por nombre con subtotal y total " +
      "general cuando hay detalle, formato simple sin cambios cuando no lo hay -- OK.",
  );

  console.log("\nTodos los checks de 'Informes diarios' (Cut Meat Distributors) pasaron.");
}

// ---------------------------------------------------------------------------
// Fecha sugerida del informe: lunes -> viernes anterior
// ---------------------------------------------------------------------------

assert.equal(lastBusinessDayBefore("2026-10-12", new Set()), "2026-10-09");
assert.equal(
  lastBusinessDayBefore("2026-10-12", new Set(["2026-10-09"])),
  "2026-10-08",
  "feriado configurado también se salta",
);
assert.equal(isoWeekday("2026-10-12"), 1, "12/10/2026 es lunes");
assert.equal(addDays("2026-10-09", 3), "2026-10-12");

console.log("Fecha sugerida del informe (fin de semana y feriados): OK.");

// ---------------------------------------------------------------------------
// Aislamiento entre empresas: el portal cliente no debe poder ver este
// módulo, y todo el acceso de admin pasa por is_admin() + is_cut_meat_company.
// ---------------------------------------------------------------------------

const read = (file: string) => readFileSync(file, "utf8");

const migration = read("supabase/migrations/20261012120000_cutmeat_daily_reports.sql");
assert.match(
  migration,
  /create or replace function public\.is_cut_meat_company/i,
  "función is_cut_meat_company definida",
);
assert.match(migration, /slug = 'cut-meat-distributors'/, "is_cut_meat_company filtra por el slug correcto");
const policyBlocks = migration.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
const cutmeatPolicies = policyBlocks.filter((block) => /cutmeat_daily_/i.test(block));
assert.ok(cutmeatPolicies.length >= 8, "hay políticas para las tablas cutmeat_daily_*");
for (const policy of cutmeatPolicies) {
  assert.match(policy, /is_admin\(\)/, `política sin is_admin(): ${policy.slice(0, 60)}`);
  assert.match(policy, /is_cut_meat_company/, `política sin is_cut_meat_company: ${policy.slice(0, 60)}`);
}
assert.match(
  migration,
  /storage\.objects[\s\S]*bucket_id = 'cutmeat-daily' AND public\.is_admin\(\)/,
  "bucket de storage también exige is_admin()",
);

assert.match(
  read("src/services/cutmeat-daily.ts"),
  /\.eq\("slug", "cut-meat-distributors"\)/,
  "resolveCutMeatCompany filtra por el slug de Cut Meat Distributors",
);

const adminGatedFiles = [
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/daily-reports/page.tsx",
  "src/app/api/cutmeat-daily/[companyId]/pdf/route.ts",
  "src/app/api/cutmeat-daily/[companyId]/pdf/zip/route.ts",
];
for (const file of adminGatedFiles)
  assert.match(read(file), /requireAdmin\(\)/, `${file} exige requireAdmin()`);
for (const action of [
  "ensureDailyReport",
  "closeDailyReport",
  "reopenDailyReport",
  "saveReconciliation",
  "saveBankExport",
  "saveCutMeatSettings",
  "saveVarianceLine",
  "deleteVarianceLine",
  "generateDailyPdf",
])
  assert.match(
    read("src/actions/cutmeat-daily.ts"),
    new RegExp(`export async function ${action}[\\s\\S]*?authorize\\(`),
    `${action} llama a authorize() (admin + empresa correcta)`,
  );

const allowedDirs = [
  "src/lib/cutmeat-daily",
  "src/services/cutmeat-daily.ts",
  "src/actions/cutmeat-daily.ts",
  "src/components/cutmeat-daily",
  "src/app/api/cutmeat-daily",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/daily-reports",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/page.tsx",
  // Módulo separado (Fase 1 de "Recurrentes" / "Historial diario"), misma
  // empresa y mismo requisito de aislamiento del portal cliente -- ver
  // docs/CUTMEAT_RECURRENTES.md. "Informes diarios" ahora LEE
  // cutmeat_recurrentes (fuente única de recurrentes), así que estos
  // archivos quedan en el allowlist también por ese motivo.
  "src/lib/cutmeat-recurrentes",
  "src/services/cutmeat-recurrentes.ts",
  "src/services/cutmeat-daily-history.ts",
  "src/actions/cutmeat-recurrentes.ts",
  "src/components/cutmeat-recurrentes",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/recurrentes",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/historial-diario",
  // Módulo separado (Fase 2 "Paquete para el dueño"), misma empresa y
  // mismo requisito de aislamiento del portal cliente -- ver
  // docs/CUTMEAT_PACKAGE.md.
  "src/lib/cutmeat-reports",
  "src/services/cutmeat-report-packages.ts",
  "src/actions/cutmeat-report-packages.ts",
  "src/components/cutmeat-reports",
  "src/app/api/cutmeat-reports",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/paquete-dueno",
];
function isAllowed(filePath: string) {
  return allowedDirs.some((allowed) => filePath === allowed || filePath.startsWith(`${allowed}/`));
}
function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}
const offenders: string[] = [];
for (const file of walk("src")) {
  if (isAllowed(file)) continue;
  const contents = readFileSync(file, "utf8");
  if (/cutmeat|daily-reports/i.test(contents)) offenders.push(file);
}
assert.deepEqual(
  offenders,
  [],
  `archivos fuera del módulo que mencionan "Informes diarios": ${offenders.join(", ")}`,
);

console.log(
  "Aislamiento entre empresas: RLS admin+empresa, rutas con requireAdmin(), " +
    "sin referencias desde el portal cliente -- OK.",
);

// ---------------------------------------------------------------------------
// D7: la UI ya no sube PDF en esas 3 pestañas (sin input type="file").
// extract*Pdf y los extractores siguen existiendo, marcados @deprecated.
// ---------------------------------------------------------------------------

for (const file of [
  "src/components/cutmeat-daily/reconciliation-tab.tsx",
  "src/components/cutmeat-daily/bank-tab.tsx",
  "src/components/cutmeat-daily/aging-tab.tsx",
]) {
  const source = read(file);
  assert.doesNotMatch(source, /type="file"/, `${file} ya no tiene un input de subida de PDF`);
  assert.doesNotMatch(source, /extract(Reconciliation|BankExport|Aging)Pdf/, `${file} ya no llama a extract*Pdf`);
}
for (const action of ["extractReconciliationPdf", "extractBankExportPdf", "extractAgingPdf"])
  assert.match(
    actionsSourceFor(action),
    new RegExp(`@deprecated[\\s\\S]{0,400}export async function ${action}`),
    `${action} sigue existiendo, marcada @deprecated`,
  );
for (const extractor of ["extractReconciliationReport", "extractBankExport", "extractAgingBalanceDetail"])
  assert.match(
    read("src/lib/cutmeat-daily/extractors.ts"),
    new RegExp(`@deprecated[\\s\\S]{0,400}export function ${extractor}`),
    `${extractor} sigue existiendo, marcada @deprecated`,
  );

function actionsSourceFor(_action: string) {
  return read("src/actions/cutmeat-daily.ts");
}

console.log(
  "D7: sin input de subida de PDF en las 3 pestañas; extract*Pdf y los " +
    "extractores siguen existiendo, marcados @deprecated -- OK.",
);

// ---------------------------------------------------------------------------
// B: una sola fuente de recurrentes -- "Informes diarios" lee y vincula
// contra cutmeat_recurrentes; cutmeat_daily_recurring_payments (la tabla
// vieja, duplicada) se retiró por migración.
// ---------------------------------------------------------------------------

const servicesSource = read("src/services/cutmeat-daily.ts");
assert.match(
  servicesSource,
  /getRecurringPayments[\s\S]*?\.from\("cutmeat_recurrentes"\)/,
  "getRecurringPayments lee de cutmeat_recurrentes",
);
assert.doesNotMatch(
  servicesSource,
  /getDailyReportWorkspace[\s\S]*cutmeat_daily_recurring_payments/,
  "getDailyReportWorkspace ya no lee cutmeat_daily_recurring_payments",
);
const dailyActionsSource = read("src/actions/cutmeat-daily.ts");
assert.doesNotMatch(
  dailyActionsSource,
  /cutmeat_daily_recurring_payments/,
  "actions/cutmeat-daily.ts ya no referencia cutmeat_daily_recurring_payments",
);
assert.doesNotMatch(
  dailyActionsSource,
  /export async function (saveRecurringPayment|deleteRecurringPayment)/,
  "saveRecurringPayment/deleteRecurringPayment (tabla vieja) se eliminaron, no quedan como dead code",
);
assert.match(
  read("supabase/migrations/20261013114120_cutmeat_daily_bank_movements_relink_recurring.sql"),
  /REFERENCES public\.cutmeat_recurrentes\(id\) ON DELETE SET NULL/,
  "cutmeat_daily_bank_movements.linked_recurring_id apunta por FK a cutmeat_recurrentes",
);
assert.match(
  read("supabase/migrations/20261013123815_cutmeat_daily_retire_old_recurring_payments.sql"),
  /RENAME TO cutmeat_daily_recurring_payments_retired_20261013/,
  "migración de retiro de cutmeat_daily_recurring_payments existe",
);

console.log(
  "B: Informes diarios lee y vincula cutmeat_recurrentes (fuente única); " +
    "cutmeat_daily_recurring_payments se retiró -- OK.",
);

// ---------------------------------------------------------------------------
// D8 + D9 + D10: contrato de datos -- origen (source/loaded_by/loaded_at),
// bloqueo de días cerrados a nivel de base, claves únicas para upsert
// idempotente, y la función de solo lectura cutmeat_daily_controls.
// ---------------------------------------------------------------------------

const contractMigration = read("supabase/migrations/20261013131000_cutmeat_daily_calc_fixes.sql");
const dataContractMigration = read("supabase/migrations/20261013130000_cutmeat_daily_data_contract.sql");

assert.match(
  contractMigration,
  /CHECK \(source IN \(''?manual''?, ''?claude-controlado''?\)\)/,
  "source es 'manual' | 'claude-controlado'",
);
assert.match(
  read("src/actions/cutmeat-daily.ts"),
  /source: "claude-controlado"/,
  "loadDailyReportData marca el origen como claude-controlado",
);
assert.doesNotMatch(
  read("src/actions/cutmeat-daily.ts"),
  /\bclaude_import\b/,
  "no queda ningún rastro del valor anterior (claude_import)",
);

assert.match(
  dataContractMigration,
  /CREATE OR REPLACE FUNCTION public\.cutmeat_daily_block_closed_write/,
  "función de bloqueo de días cerrados definida",
);
assert.match(
  dataContractMigration,
  /report_status = 'closed'/,
  "el bloqueo compara contra status = 'closed'",
);
const closedWriteTriggerTargets = [
  "cutmeat_daily_reconciliation",
  "cutmeat_daily_reconciliation_items",
  "cutmeat_daily_bank_export",
  "cutmeat_daily_bank_movements",
  "cutmeat_daily_aging_vendors",
  "cutmeat_daily_aging_vendor_items",
  "cutmeat_daily_aging_customers",
  "cutmeat_daily_aging_customer_items",
  "cutmeat_daily_variance_lines",
];
for (const table of closedWriteTriggerTargets)
  assert.match(
    contractMigration,
    new RegExp(`CREATE TRIGGER ${table}_block_closed_write[\\s\\S]{0,40}ON public\\.${table}\\b`),
    `${table} tiene el trigger de bloqueo de días cerrados`,
  );
assert.doesNotMatch(
  contractMigration,
  /ON public\.cutmeat_daily_generated_pdfs[\s\S]{0,80}block_closed_write/,
  "cutmeat_daily_generated_pdfs no se bloquea -- generar el PDF es lo que se hace con el día ya cerrado",
);

assert.match(
  contractMigration,
  /balance_after_weekly NUMERIC\(14, 2\)/,
  "cutmeat_daily_reports congela balance_after_weekly al cerrar",
);
assert.match(contractMigration, /balance_gabriel NUMERIC\(14, 2\)/, "y balance_gabriel");
assert.match(
  read("src/actions/cutmeat-daily.ts"),
  /closeDailyReport[\s\S]*?balance_after_weekly: workspace\.weeklyPayments\?\.balanceAfterWeeklyPayments/,
  "closeDailyReport congela balance_after_weekly/balance_gabriel al cerrar",
);
assert.match(
  read("src/actions/cutmeat-daily.ts"),
  /reopenDailyReport[\s\S]*?balance_after_weekly: null/,
  "reopenDailyReport limpia los valores congelados",
);

assert.match(
  contractMigration,
  /gabriel_starting_balance NUMERIC\(14, 2\) NOT NULL DEFAULT 0/,
  "cutmeat_daily_settings tiene el valor de arranque de Balance GABRIEL",
);
assert.match(
  contractMigration,
  /current_week_income NUMERIC\(14, 2\) NOT NULL DEFAULT 7500/,
  "y el ingreso plano de la semana en curso",
);

for (const table of ["cutmeat_daily_aging_vendor_items", "cutmeat_daily_aging_customer_items"])
  for (const column of ["txn_date", "txn_type", "num", "due_date", "amount", "open_balance"])
    assert.match(contractMigration, new RegExp(`${table}[\\s\\S]{0,400}${column}`), `${table}.${column}`);

assert.match(
  contractMigration,
  /CREATE TABLE IF NOT EXISTS public\.cutmeat_daily_variance_lines/,
  "tabla de líneas libres de Variación Diaria",
);

const varianceSectionMigration = read(
  "supabase/migrations/20261013133511_cutmeat_daily_variance_lines_section.sql",
);
assert.match(
  varianceSectionMigration,
  /ADD COLUMN section TEXT NOT NULL DEFAULT 'variance'/,
  "section separa Variación Diaria de depósitos sin cobrar, default 'variance' para las filas ya cargadas",
);
assert.match(
  varianceSectionMigration,
  /CHECK \(section IN \('variance', 'uncollected_deposit'\)\)/,
  "section solo acepta los 2 valores conocidos",
);

assert.match(
  contractMigration,
  /CREATE OR REPLACE FUNCTION public\.cutmeat_daily_controls/,
  "función de solo lectura cutmeat_daily_controls",
);
assert.doesNotMatch(
  contractMigration.match(/CREATE OR REPLACE FUNCTION public\.cutmeat_daily_controls[\s\S]*?\$\$;/)?.[0] ?? "",
  /INSERT INTO|UPDATE public\.|DELETE FROM/,
  "cutmeat_daily_controls es de solo lectura -- ningún INSERT/UPDATE/DELETE",
);
const controlsBody = contractMigration.match(/CREATE OR REPLACE FUNCTION public\.cutmeat_daily_controls[\s\S]*?\$\$;/)?.[0] ?? "";
assert.match(controlsBody, /statement_control/, "control 1: conciliación (statement + sin cobrar = register)");
assert.match(controlsBody, /weekly_control/, "control 2: register + prior + semana = B");
assert.match(controlsBody, /gabriel_control/, "control 3: Gabriel vs. B del día anterior cerrado");
assert.match(controlsBody, /not_entered_pending/, "control 4: no ingresados (movimientos sin clasificar)");
assert.match(controlsBody, /FROM public\.cutmeat_recurrentes/, "los recurrentes se leen de cutmeat_recurrentes, no de la tabla vieja");

console.log(
  "D8-D10: origen (manual/claude-controlado) + loaded_by/loaded_at, bloqueo " +
    "de días cerrados a nivel de base (9 tablas), detalle de aging, " +
    "Variación Diaria libre y cutmeat_daily_controls (4 controles, solo " +
    "lectura) -- OK.",
);

// ---------------------------------------------------------------------------
// D9: claves únicas para upsert idempotente -- un upsert repetido no
// duplica. Se audita que cada onConflict de las acciones apunte a una
// columna/combinación declarada UNIQUE en el esquema (no se agregan
// constraints nuevas porque ya estaban todas).
// ---------------------------------------------------------------------------

const schemaMigration = read("supabase/migrations/20261012120000_cutmeat_daily_reports.sql");
const actionsSource = read("src/actions/cutmeat-daily.ts");
const onConflictTargets = Array.from(actionsSource.matchAll(/onConflict: "([^"]+)"/g)).map((m) => m[1]);
assert.ok(onConflictTargets.length >= 5, "hay varios upserts con onConflict");
for (const target of new Set(onConflictTargets)) {
  const columns = target.split(",");
  const unique =
    (columns.length === 1 &&
      new RegExp(`${columns[0]}\\s+UUID[\\s\\S]{0,20}UNIQUE|UNIQUE\\s*\\(\\s*${columns[0]}\\s*\\)`).test(
        schemaMigration,
      )) ||
    new RegExp(`UNIQUE\\s*\\(\\s*${columns.join("\\s*,\\s*")}\\s*\\)`).test(schemaMigration);
  assert.ok(unique, `onConflict("${target}") tiene una UNIQUE declarada en el esquema`);
}

console.log("D9: cada upsert con onConflict apunta a una clave única ya declarada -- OK.");

// ---------------------------------------------------------------------------
// D13: Balance GABRIEL parte de "Balance after Weekly Payments + Not
// entered Sales" (balance_with_not_entered), congelado al cerrar y
// limpiado al reabrir -- no solo balance_after_weekly.
// ---------------------------------------------------------------------------

assert.match(
  read("supabase/migrations/20261014090000_cutmeat_daily_balance_with_not_entered.sql"),
  /add column if not exists balance_with_not_entered numeric\(14, 2\)/i,
  "migración: cutmeat_daily_reports.balance_with_not_entered existe",
);
assert.match(
  read("src/actions/cutmeat-daily.ts"),
  /closeDailyReport[\s\S]*?balance_with_not_entered: workspace\.balanceWithNotEntered/,
  "closeDailyReport congela balance_with_not_entered al cerrar",
);
assert.match(
  read("src/actions/cutmeat-daily.ts"),
  /reopenDailyReport[\s\S]*?balance_with_not_entered: null/,
  "reopenDailyReport limpia balance_with_not_entered",
);
assert.match(
  read("src/services/cutmeat-daily.ts"),
  /getPreviousClosedBalance[\s\S]{0,900}balance_with_not_entered/,
  "getPreviousClosedBalance lee balance_with_not_entered (no balance_after_weekly) del informe cerrado en vivo",
);

console.log(
  "D13: Balance GABRIEL parte de Balance after Weekly Payments + Not entered Sales " +
    "(balance_with_not_entered), congelado al cerrar y limpiado al reabrir -- OK.",
);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
