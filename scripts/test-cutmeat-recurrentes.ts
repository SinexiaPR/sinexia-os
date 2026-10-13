// Verifica "Recurrentes" e "Historial diario" de Cut Meat Distributors
// (Wagyu Food Service LLC) contra los datos reales de octubre 2026, al
// centavo, más el aislamiento entre empresas y el acceso de solo lectura
// de Gabriel (el dueño).
//
//   npx tsx scripts/test-cutmeat-recurrentes.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  markPaid,
  paidVariance,
  pendingToConfirm,
  shiftPeriod,
  totalsByWeek,
  type Recurrente,
} from "../src/lib/cutmeat-recurrentes/calculations";

// ---------------------------------------------------------------------------
// A. Recurrentes de octubre 2026, al cierre del 10/09
// ---------------------------------------------------------------------------

const REPORT_DATE = "2026-10-09";

const recurrentes: Recurrente[] = [
  { id: "1", vendor: "Caparra Country - Gabriel Manzanares", dueDate: "2026-09-03", amount: 692, pagado: false },
  { id: "2", vendor: "Carlos Mercado Seguros", dueDate: null, amount: 0, pagado: false },
  { id: "3", vendor: "Liberty Movil", dueDate: null, amount: 284.39, pagado: true, paidAmount: 257.11 },
  { id: "4", vendor: "Deposito Oriental Bank - Seg de vida - J Manzanares", dueDate: "2026-10-01", amount: 350, pagado: true, paidAmount: 500 },
  { id: "5", vendor: "Juan Diaz", dueDate: "2026-10-01", amount: 150, pagado: false },
  { id: "6", vendor: "PenFed - Jose Manzanares", dueDate: "2026-10-01", amount: 800, pagado: true, paidAmount: 800 },
  { id: "7", vendor: "Deposito - Jose Manzanares", dueDate: "2026-10-01", amount: 1200, pagado: false },
  { id: "8", vendor: "Caparra Country - Gabriel Manzanares", dueDate: "2026-10-01", amount: 692, pagado: false },
  { id: "9", vendor: "CCC Logistic - Storage", dueDate: "2026-10-02", amount: 95, pagado: false },
  { id: "10", vendor: "NOMINA", dueDate: "2026-10-08", amount: 400, pagado: false },
  { id: "11", vendor: "Internal Revenue Service", dueDate: "2026-10-09", amount: 600, pagado: false },
  { id: "12", vendor: "Departamento de Hacienda", dueDate: "2026-10-09", amount: 180, pagado: false },
  { id: "13", vendor: "SINERGIA LLC", dueDate: "2026-10-09", amount: 180, pagado: true, paidAmount: 180 },
  { id: "14", vendor: "Carlos Mercado Seguros", dueDate: null, amount: 0, pagado: false },
  { id: "15", vendor: "NOMINA", dueDate: "2026-10-15", amount: 400, pagado: false },
  { id: "16", vendor: "SINERGIA LLC", dueDate: "2026-10-16", amount: 180, pagado: false },
];

const totals = totalsByWeek(recurrentes, REPORT_DATE, 3);
assert.equal(totals.prior, 2829.0, `prior ${totals.prior}`);
assert.equal(totals.weeks[0]?.total, 1180.0, `semana 04/10-10/10: ${totals.weeks[0]?.total}`);
assert.equal(totals.weeks[0]?.weekStart, "2026-10-04");
assert.equal(totals.weeks[0]?.weekEnd, "2026-10-10");
assert.equal(totals.weeks[1]?.total, 580.0, `semana 11/10-17/10: ${totals.weeks[1]?.total}`);
assert.equal(totals.weeks[2]?.total, 0, `semana 18/10-24/10: ${totals.weeks[2]?.total}`);
assert.equal(totals.total, 4589.0, `total ${totals.total}`);

console.log(
  "Totales de recurrentes al cierre del 09/10/2026 (antes 2,829.00 / semana 1,180.00 / " +
    "siguiente 580.00 / después 0.00 / total 4,589.00) -- OK.",
);

const confirm = pendingToConfirm(recurrentes, "2026-10-12")
  .map((r) => r.id)
  .sort((a, b) => Number(a) - Number(b));
assert.deepEqual(confirm, ["1", "5", "7", "8", "9", "10", "11", "12"]);
console.log(
  "Por confirmar al 10/12 (Caparra x2, Juan Diaz, Depósito Jose Manzanares, CCC, " +
    "NOMINA 10/08, IRS, Hacienda) -- OK.",
);

const varianceLiberty = paidVariance(recurrentes[2]!);
assert.equal(varianceLiberty, 27.28, `variación Liberty Movil ${varianceLiberty}`);
const varianceOriental = paidVariance(recurrentes[3]!);
assert.equal(varianceOriental, -150, `variación Depósito Oriental Bank ${varianceOriental}`);
const variancePenFed = paidVariance(recurrentes[5]!);
assert.equal(variancePenFed, 0, "PenFed pagado sin variación informada");
console.log("Variación Diaria de recurrentes pagados (Liberty +27.28, Oriental -150.00) -- OK.");

const marked = markPaid(recurrentes[4]!, { paid: true, paidDate: "2026-10-13", paidAmount: 150 });
assert.equal(marked.pagado, true);
assert.equal(marked.paidDate, "2026-10-13");
assert.equal(marked.paidAmount, 150);
const unmarked = markPaid(marked, { paid: false });
assert.equal(unmarked.pagado, false);
assert.equal(unmarked.paidDate, null);
assert.equal(unmarked.paidAmount, null);
const markedNoAmount = markPaid(recurrentes[9]!, { paid: true, paidDate: "2026-10-08" });
assert.equal(markedNoAmount.paidAmount, 400, "sin monto real informado, asume el monto recurrente");
console.log("markPaid (marcar, desmarcar, sin monto real informado) -- OK.");

assert.equal(shiftPeriod("2026-10-01", 1), "2026-11-01");
assert.equal(shiftPeriod("2026-10-15", 1), "2026-11-15");
assert.equal(shiftPeriod("2026-10-16", 1), "2026-11-16");
console.log("shiftPeriod (copiar recurrentes de un mes al siguiente) -- OK.");

// ---------------------------------------------------------------------------
// B. Historial diario (backfill): balance del 01/10 al 09/10/2026
// ---------------------------------------------------------------------------

const round = (value: number) => Math.round(value * 100) / 100;

type HistoryRow = {
  reportDate: string;
  statement: number;
  checksAsOf: number;
  checksAfter: number;
  depositsAsOf: number;
  depositsAfter: number;
  register: number;
  prior: number;
  week: number;
  balanceAfterWeekly: number;
  balanceGabriel: number;
};

const history: HistoryRow[] = [
  { reportDate: "2026-10-01", statement: 32189.26, checksAsOf: -125.0, checksAfter: -794.01, depositsAsOf: 172.76, depositsAfter: 0, register: 31443.01, prior: -692.0, week: -3571.39, balanceAfterWeekly: 27179.62, balanceGabriel: 27224.2 },
  { reportDate: "2026-10-02", statement: 31740.77, checksAsOf: -297.76, checksAfter: 0, depositsAsOf: 0, depositsAfter: 0, register: 31443.01, prior: -692.0, week: -3571.39, balanceAfterWeekly: 27179.62, balanceGabriel: 27179.62 },
  { reportDate: "2026-10-05", statement: 31740.77, checksAsOf: -297.76, checksAfter: -11847.73, depositsAsOf: 20477.6, depositsAfter: 0, register: 40072.88, prior: -3463.39, week: -1360.0, balanceAfterWeekly: 35249.49, balanceGabriel: 27179.62 },
  { reportDate: "2026-10-06", statement: 31740.77, checksAsOf: -12145.49, checksAfter: 0, depositsAsOf: 20477.6, depositsAfter: 0, register: 40072.88, prior: -3463.39, week: -1360.0, balanceAfterWeekly: 35249.49, balanceGabriel: 35249.49 },
  { reportDate: "2026-10-07", statement: 40197.88, checksAsOf: -125.0, checksAfter: 0, depositsAsOf: 0, depositsAfter: 0, register: 40072.88, prior: -3463.39, week: -1360.0, balanceAfterWeekly: 35249.49, balanceGabriel: 35249.49 },
  { reportDate: "2026-10-08", statement: 40197.88, checksAsOf: -125.0, checksAfter: -526.28, depositsAsOf: 346.28, depositsAfter: 0, register: 39892.88, prior: -3463.39, week: -1180.0, balanceAfterWeekly: 35249.49, balanceGabriel: 35249.49 },
  { reportDate: "2026-10-09", statement: 40107.05, checksAsOf: -471.28, checksAfter: 0, depositsAsOf: -500.0, depositsAfter: 0, register: 39135.77, prior: -2829.0, week: -1180.0, balanceAfterWeekly: 35126.77, balanceGabriel: 35249.49 },
];

for (const [index, row] of history.entries()) {
  const computedRegister = round(row.statement + row.checksAsOf + row.checksAfter + row.depositsAsOf + row.depositsAfter);
  assert.equal(
    computedRegister,
    row.register,
    `${row.reportDate}: statement+checks+deposits (${computedRegister}) != register (${row.register})`,
  );
  const computedB = round(row.register + row.prior + row.week);
  assert.equal(
    computedB,
    row.balanceAfterWeekly,
    `${row.reportDate}: register+prior+week (${computedB}) != B (${row.balanceAfterWeekly})`,
  );
  const previous = history[index - 1];
  if (previous) {
    assert.equal(
      row.balanceGabriel,
      previous.balanceAfterWeekly,
      `${row.reportDate}: Gabriel (${row.balanceGabriel}) != B del día anterior (${previous.balanceAfterWeekly})`,
    );
  }
}
// El 10/01 no tiene día anterior en esta tabla -- su Gabriel es la excepción
// documentada (viene del PDF, no se deriva).
assert.equal(history[0]?.balanceGabriel, 27224.2);

console.log(
  "Historial diario 01/10-09/10/2026: statement+checks+depósitos=register, " +
    "register+prior+semana=B, y Gabriel[d]=B[d-1] (salvo el 10/01, valor del PDF) -- OK.",
);

// ---------------------------------------------------------------------------
// Aislamiento entre empresas y acceso de Gabriel (solo lectura)
// ---------------------------------------------------------------------------

const read = (file: string) => readFileSync(file, "utf8");

const recurrentesMigration = read(
  "supabase/migrations/20261013120000_cutmeat_recurrentes.sql",
);
const historyMigration = read("supabase/migrations/20261013122000_cutmeat_daily_history.sql");

for (const migration of [recurrentesMigration, historyMigration]) {
  assert.match(migration, /is_cut_meat_company/, "usa is_cut_meat_company()");
  assert.match(migration, /current_company_id/, "usa current_company_id() para el acceso de Gabriel");
}
// Las políticas de admin deben exigir is_admin() -- nunca una política que
// deje escribir a cualquier autenticado.
const adminPolicies = [...recurrentesMigration.matchAll(/CREATE POLICY "Admins[\s\S]*?;/g)];
assert.ok(adminPolicies.length >= 1, "hay al menos una política de admin en cutmeat_recurrentes");
for (const [policy] of adminPolicies) {
  assert.match(policy, /is_admin\(\)/);
  assert.match(policy, /FOR ALL/, "la política de admin cubre lectura y escritura");
}
// Las políticas de Gabriel deben ser SELECT únicamente -- nunca FOR ALL.
const clientPolicies = [...recurrentesMigration.matchAll(/CREATE POLICY "Cut Meat client[\s\S]*?;/g)];
assert.ok(clientPolicies.length >= 1, "hay al menos una política de cliente en cutmeat_recurrentes");
for (const [policy] of clientPolicies) {
  assert.match(policy, /FOR SELECT/, `política de Gabriel debe ser solo SELECT: ${policy.slice(0, 80)}`);
  assert.doesNotMatch(policy, /FOR ALL/, "Gabriel nunca tiene FOR ALL");
}

const servicesSource = read("src/services/cutmeat-recurrentes.ts");
assert.match(
  servicesSource,
  /requireCutMeatAccess[\s\S]*?profile\.role === "client"[\s\S]*?profile\.company_id === company\.id/,
  "requireCutMeatAccess distingue admin de Gabriel por company_id",
);
assert.match(
  servicesSource,
  /canWrite: profile\.role === "admin"/,
  "canWrite es true solo para admin -- Gabriel nunca puede escribir",
);

const actionsSource = read("src/actions/cutmeat-recurrentes.ts");
assert.match(
  actionsSource,
  /async function authorize\([\s\S]*?requireAdmin\(\)/,
  "authorize() exige requireAdmin()",
);
for (const action of ["saveRecurrente", "deleteRecurrente", "markRecurrentePaid", "copyPreviousMonth"])
  assert.match(
    actionsSource,
    new RegExp(`export async function ${action}\\([\\s\\S]*?authorize\\(`),
    `${action} llama a authorize() (que exige requireAdmin())`,
  );

const historyPageSource = read(
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/historial-diario/page.tsx",
);
assert.match(historyPageSource, /requireCutMeatAccess/, "la página de historial usa el mismo control de acceso");

console.log(
  "Aislamiento entre empresas: RLS admin+is_cut_meat_company, Gabriel solo SELECT vía " +
    "current_company_id(), acciones de escritura exigen requireAdmin() -- OK.",
);

// Ningún archivo fuera de los directorios propios de este módulo menciona
// "cutmeat-recurrentes" ni "cutmeat_daily_history" -- si el portal cliente
// lo mostrara, algún nav/sidebar/dashboard cliente lo referenciaría.
const ownAllowedDirs = [
  "src/lib/cutmeat-recurrentes",
  "src/services/cutmeat-recurrentes.ts",
  "src/services/cutmeat-daily-history.ts",
  "src/actions/cutmeat-recurrentes.ts",
  "src/components/cutmeat-recurrentes",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/recurrentes",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/historial-diario",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/page.tsx",
  // Módulo separado (Fase 2 "Paquete para el dueño") -- su servicio
  // menciona este módulo solo en un comentario de documentación, no lo
  // importa ni lo muestra al portal cliente. Ver docs/CUTMEAT_PACKAGE.md.
  "src/services/cutmeat-report-packages.ts",
];
function isOwnAllowed(filePath: string) {
  return ownAllowedDirs.some(
    (allowed) => filePath === allowed || filePath.startsWith(`${allowed}/`),
  );
}
function walkSrc(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walkSrc(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}
const offenders: string[] = [];
for (const file of walkSrc("src")) {
  if (isOwnAllowed(file)) continue;
  const contents = readFileSync(file, "utf8");
  if (/cutmeat-recurrentes|cutmeat_recurrentes|cutmeat_daily_history/i.test(contents))
    offenders.push(file);
}
assert.deepEqual(
  offenders,
  [],
  `archivos fuera del módulo que mencionan "Recurrentes"/"Historial diario": ${offenders.join(", ")}`,
);
console.log("Sin referencias desde el portal cliente a Recurrentes/Historial diario -- OK.");
