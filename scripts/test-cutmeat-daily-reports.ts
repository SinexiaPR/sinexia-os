// Verifica el motor de cálculo de "Informes diarios" (Cut Meat
// Distributors / Wagyu Food Service LLC) contra el caso real del
// 09/10/2026, al centavo, más la lógica de fechas, el aislamiento entre
// empresas y los controles de días cerrados / versionado de PDF.
//
//   npx tsx scripts/test-cutmeat-daily-reports.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  buildBalanceAfterWeeklyPayments,
  buildBalanceGabriel,
  buildBalanceWithNotEnteredSales,
  buildFinancialReport,
  buildVarianceReport,
  checkReconciliationControl,
  classifyBankMovements,
  consolidateCustomerAging,
  consolidateVendorAging,
  findUnconfiguredVendors,
  overdueUnpaidRecurring,
  splitRecurringByWeek,
  sumCurrentWeekProjectedIncome,
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
  {
    id: "r1",
    concept: "Caparra Country - Gabriel Manzanares",
    dueDate: "2026-09-03",
    amount: 692,
    isPaid: false,
  },
  {
    id: "r2",
    concept: "Carlos Mercado Seguros",
    dueDate: "2026-09-03",
    amount: 0,
    isPaid: false,
  },
  {
    id: "r3",
    concept: "Liberty Movil",
    dueDate: "2026-09-15",
    amount: 284.39,
    isPaid: true,
    actualAmount: 257.11,
  },
  {
    id: "r4",
    concept: "Scotiabank - Deposito Oriental Bank - Seg de vida - J Manzanares",
    dueDate: "2026-10-01",
    amount: 350,
    isPaid: true,
    actualAmount: 500,
  },
  { id: "r5", concept: "Juan Diaz", dueDate: "2026-10-01", amount: 150, isPaid: false },
  {
    id: "r6",
    concept: "PenFed",
    dueDate: "2026-10-01",
    amount: 800,
    isPaid: true,
  },
  {
    id: "r7",
    concept: "Plaza las Cumbres - Deposito - Jose Manzanares",
    dueDate: "2026-10-01",
    amount: 1200,
    isPaid: false,
  },
  { id: "r8", concept: "Caparra", dueDate: "2026-10-01", amount: 692, isPaid: false },
  {
    id: "r9",
    concept: "CCC Logistic - Storage",
    dueDate: "2026-10-02",
    amount: 95,
    isPaid: false,
  },
  { id: "r10", concept: "NOMINA", dueDate: "2026-10-08", amount: 400, isPaid: false },
  {
    id: "r11",
    concept: "SS Med Jul-26 IRS",
    dueDate: "2026-10-09",
    amount: 600,
    isPaid: false,
  },
  {
    id: "r12",
    concept: "Ret Jul-2026 Departamento de Hacienda",
    dueDate: "2026-10-09",
    amount: 180,
    isPaid: false,
  },
  {
    id: "r13",
    concept: "SINERGIA LLC",
    dueDate: "2026-10-09",
    amount: 180,
    isPaid: true,
  },
  {
    id: "r14",
    concept: "Carlos Mercado Seguros",
    dueDate: "2026-09-20",
    amount: 0,
    isPaid: false,
  },
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

const weeklyPayments = buildBalanceAfterWeeklyPayments(
  reconciliation.register,
  buckets,
);
assert.equal(weeklyPayments.recurrentesPrior, 2829.0);
assert.equal(weeklyPayments.recurrentesThisWeek, 1180.0);
assert.equal(weeklyPayments.balanceAfterWeeklyPayments, 35126.77);

const incomeDays = [5, 6, 7, 8, 9, 10].map((day) => ({
  date: `2026-10-${String(day).padStart(2, "0")}`,
  amount: 1500,
}));
const currentWeekIncome = sumCurrentWeekProjectedIncome(incomeDays, REPORT_DATE);
assert.equal(currentWeekIncome, 7500, "lunes excluido de la semana en curso");

const financial = buildFinancialReport({
  reportDate: REPORT_DATE,
  balanceAfterWeeklyPayments: weeklyPayments.balanceAfterWeeklyPayments,
  currentWeekIncome,
  nextWeekBuckets: buckets.nextWeek,
  weekAfterBuckets: buckets.weekAfter,
});
assert.equal(financial.day7.balance, 42626.77);
assert.equal(financial.day7.date, "2026-10-12");
assert.equal(financial.day14.recurrentes, 580);
assert.equal(financial.day14.balance, 51046.77);
assert.equal(financial.day14.date, "2026-10-19");
assert.equal(financial.day21.balance, 60046.77);
assert.equal(financial.day21.date, "2026-10-26");

const variance = buildVarianceReport(buckets.paid);
assert.equal(variance.items.length, 2);
assert.equal(variance.items[0]?.variance, 27.28);
assert.equal(variance.items[1]?.variance, -150);
assert.equal(variance.totalVariance, -122.72);

const balanceGabriel = buildBalanceGabriel(
  weeklyPayments.balanceAfterWeeklyPayments,
  variance.totalVariance,
);
assert.equal(balanceGabriel, 35249.49);

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

const vendorItemsWithUnknown = [
  ...vendorItems,
  { name: "Suplidor Nuevo LLC", balance: 120 },
];
assert.deepEqual(
  findUnconfiguredVendors(vendorItemsWithUnknown, vendorConfig).map((v) => v.name),
  ["Suplidor Nuevo LLC"],
);

const customerAging = consolidateCustomerAging(16658.08);
assert.equal(customerAging.consolidated, 16658.08);

console.log(
  "Caso 09/10/2026: control de conciliación, recurrentes, Financial Report, " +
    "Variación Diaria, Balance GABRIEL, Not entered Sales y aging consolidados -- OK.",
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
  bankMovements: [
    { id: "m3", description: "ACH desconocido XYZ", amount: 88.4, direction: "egreso" },
  ],
  recurring,
  vendorAgingItems: vendorItemsWithUnknown,
  vendorAgingConfig: vendorConfig,
  sources: {
    hasReconciliation: true,
    hasBankExport: true,
    hasVendorAging: true,
    hasCustomerAging: true,
  },
});
assert.ok(completenessWarnings.some((w) => w.includes("sin clasificar")));
assert.ok(completenessWarnings.some((w) => w.includes("Suplidor Nuevo LLC")));
assert.ok(completenessWarnings.some((w) => w.includes("Recurrente vencido")));

console.log("Alertas de completitud (sin clasificar, vencidos, proveedor nuevo): OK.");

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
assert.match(
  migration,
  /slug = 'cut-meat-distributors'/,
  "is_cut_meat_company filtra por el slug correcto",
);
// Toda tabla cutmeat_daily_* debe combinar is_admin() con la validación de
// empresa (directa o vía cutmeat_daily_reports) -- nunca una política que
// solo exija is_admin().
const policyBlocks = migration.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
const cutmeatPolicies = policyBlocks.filter((block) => /cutmeat_daily_/i.test(block));
assert.ok(cutmeatPolicies.length >= 8, "hay políticas para las tablas cutmeat_daily_*");
for (const policy of cutmeatPolicies) {
  assert.match(policy, /is_admin\(\)/, `política sin is_admin(): ${policy.slice(0, 60)}`);
  assert.match(
    policy,
    /is_cut_meat_company/,
    `política sin is_cut_meat_company: ${policy.slice(0, 60)}`,
  );
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
  "generateDailyPdf",
])
  assert.match(
    read("src/actions/cutmeat-daily.ts"),
    new RegExp(`export async function ${action}[\\s\\S]*?authorize\\(`),
    `${action} llama a authorize() (admin + empresa correcta)`,
  );

// Ningún archivo fuera de los directorios propios del módulo (lib/services/
// actions/components/app routes bajo admin o api/cutmeat-daily) menciona
// "cutmeat" ni "daily-reports" -- si el portal cliente lo mostrara, algún
// nav/sidebar/dashboard cliente lo referenciaría.
const allowedDirs = [
  "src/lib/cutmeat-daily",
  "src/services/cutmeat-daily.ts",
  "src/actions/cutmeat-daily.ts",
  "src/components/cutmeat-daily",
  "src/app/api/cutmeat-daily",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/daily-reports",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/page.tsx",
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
// Días cerrados: no se puede editar sin reabrir primero.
// ---------------------------------------------------------------------------

const actionsSource = read("src/actions/cutmeat-daily.ts");
assert.match(
  actionsSource,
  /function requireEditableReport[\s\S]*status === "closed"[\s\S]*El día está cerrado/,
  "requireEditableReport bloquea edición de un día cerrado",
);
for (const action of ["saveReconciliation", "saveBankExport", "saveAging"])
  assert.match(
    actionsSource,
    new RegExp(`async function ${action}\\([\\s\\S]*?requireEditableReport\\(`),
    `${action} llama a requireEditableReport()`,
  );
assert.match(actionsSource, /status: "closed"/, "closeDailyReport marca el día como cerrado");
assert.match(actionsSource, /status: "reopened"/, "reopenDailyReport lo reabre");

console.log("Días cerrados: bloqueo de edición sin reabrir -- OK.");

// ---------------------------------------------------------------------------
// Versionado de PDF: cada regeneración crea una fila nueva, nunca pisa.
// ---------------------------------------------------------------------------

assert.match(
  migration,
  /UNIQUE \(report_id, doc_type, version\)/,
  "constraint de unicidad por versión en cutmeat_daily_generated_pdfs",
);
assert.match(
  actionsSource,
  /const version = \(existing\.data\?\.version \?\? 0\) \+ 1/,
  "generateDailyPdf calcula la siguiente versión en vez de pisar la existente",
);
assert.match(
  actionsSource,
  /upsert: false/,
  "la subida a Storage nunca sobrescribe un storage_path existente",
);
assert.match(
  actionsSource,
  /logEvent\(report\.id, "pdf_generated", profile\.id/,
  "cada generación de PDF queda en el audit log con quién y cuándo",
);

console.log("Versionado de PDF (nunca sobrescribe, con audit log) -- OK.");
