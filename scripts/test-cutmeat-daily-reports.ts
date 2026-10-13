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
  buildAgingVendorsPdf,
  money,
} from "../src/lib/cutmeat-daily/pdf";
import {
  buildBalanceAfterWeeklyPayments,
  buildBalanceGabriel,
  buildBalanceWithNotEnteredSales,
  buildFinancialReport,
  checkReconciliationControl,
  classifyBankMovements,
  consolidateCustomerAging,
  consolidateVendorAging,
  findUnconfiguredVendors,
  groupAgingItems,
  overdueUnpaidRecurring,
  splitRecurringByWeek,
  totalVarianceOf,
  type AgingDetailLine,
  type RecurringPayment,
} from "../src/lib/cutmeat-daily/calculations";
import {
  checkDailyReportCompleteness,
} from "../src/lib/cutmeat-daily/completeness";
import {
  addDays,
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
const varianceLines = [
  { concept: "Diferencia Pago Recurrentes (Liberty Movil)", amount: 27.28 },
  { concept: "First Bank - Service Charges", amount: -150 },
];
assert.equal(totalVarianceOf(varianceLines), -122.72);
assert.equal(totalVarianceOf([]), 0, "sin líneas, el total es 0");

// A1: Balance GABRIEL = B del último día CERRADO anterior (no "B -
// variación"). El 08/10 cerró con B = 35,249.49 (cutmeat_daily_history).
const balanceGabriel = buildBalanceGabriel(35249.49, 0);
assert.equal(balanceGabriel, 35249.49, "Gabriel del 09/10 = B del 08/10");

const withNotEntered = buildBalanceWithNotEnteredSales(
  weeklyPayments.balanceAfterWeeklyPayments,
  [{ description: "Costco", amount: 346.28 }],
);
assert.equal(withNotEntered, 35473.05);

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
});
assert.ok(completenessWarnings.some((w) => w.includes("sin clasificar")));
assert.ok(completenessWarnings.some((w) => w.includes("Suplidor Nuevo LLC")));
assert.ok(completenessWarnings.some((w) => w.includes("Recurrente vencido")));

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

async function main() {
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
  "saveRecurringPayment",
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
// B: una sola fuente de recurrentes -- "Informes diarios" lee
// cutmeat_recurrentes (Fase 1), no cutmeat_daily_recurring_payments.
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
assert.match(
  read("src/actions/cutmeat-daily.ts"),
  /@deprecated[\s\S]{0,400}export async function saveRecurringPayment/,
  "saveRecurringPayment (cutmeat_daily_recurring_payments) queda @deprecated, no se borra",
);

console.log("B: Informes diarios lee cutmeat_recurrentes (fuente única) -- OK.");

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
