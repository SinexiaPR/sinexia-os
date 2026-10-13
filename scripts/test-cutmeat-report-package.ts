// Verifica el "Paquete para el dueño" (Fase 2) de Cut Meat Distributors:
// el plan de armado, el resaltado de la portada y el control de acceso.
// No depende de una base de datos -- los tests que necesitarían un día
// cerrado real con datos de "Informes diarios" se hacen sobre el código
// fuente (igual convención que el resto de los tests de aislamiento de
// este repo), no cargando datos de producción para esto.
//
//   npx tsx scripts/test-cutmeat-report-package.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  applyHighlights,
  DEFAULT_PACKAGE_HIGHLIGHTS,
} from "../src/lib/cutmeat-reports/package/highlights";
import { buildPackagePlan, type PackagePageCounts } from "../src/lib/cutmeat-reports/package/plan";
import { renderPdfPageToPng } from "../src/lib/cutmeat-reports/package/render";
import { money } from "../src/lib/cutmeat-daily/pdf";

// ---------------------------------------------------------------------------
// buildPackagePlan: orden, sin duplicar la portada, total de páginas
// ---------------------------------------------------------------------------

const REFERENCE_COUNTS: PackagePageCounts = {
  reconciliation: 1,
  bank: 1,
  consolidated: 3,
  vendors: 1,
  customers: 2,
};

const referencePlan = buildPackagePlan(REFERENCE_COUNTS);
assert.deepEqual(
  referencePlan.steps.map((s) => s.doc),
  ["consolidated", "reconciliation", "bank", "consolidated", "vendors", "customers"],
  "orden: portada (Consolidado) -> Reconciliation -> Export -> Consolidado -> Vendors -> Customers",
);
assert.equal(referencePlan.steps[0]?.isCover, true, "el primer paso es la portada");
assert.deepEqual(referencePlan.steps[0]?.pageIndexes, [2], "portada = última hoja del Consolidado (índice 2 de 3)");
assert.deepEqual(
  referencePlan.steps[3]?.pageIndexes,
  [0, 1],
  "bloque 4 (Consolidado) excluye su última hoja -- ya es la portada",
);
assert.equal(referencePlan.totalPages, 8, "con la configuración de referencia, 8 páginas");
console.log(
  "buildPackagePlan: orden correcto, portada = última hoja del Consolidado sin duplicarla -- OK.",
);

for (const customerPages of [1, 2, 3]) {
  const counts: PackagePageCounts = { ...REFERENCE_COUNTS, customers: customerPages };
  const plan = buildPackagePlan(counts);
  const sumOfIndividuals = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(
    plan.totalPages,
    sumOfIndividuals,
    `Aging Customers de ${customerPages} página(s): total del paquete (${plan.totalPages}) debe ser la suma de los 5 PDF (${sumOfIndividuals})`,
  );
}
console.log(
  "Total de páginas del paquete = suma de los 5 PDF individuales, con Aging Customers de 1/2/3 páginas -- OK.",
);

assert.throws(
  () => buildPackagePlan({ ...REFERENCE_COUNTS, vendors: 0 }),
  /al menos 1 página/,
  "un documento con 0 páginas nunca puede pasar (ninguno de los 5 PDF puede estar vacío)",
);

// ---------------------------------------------------------------------------
// applyHighlights: no altera el texto extraíble, y las cifras del caso de
// validación del 09/10/2026 se formatean igual que en la portada real.
// ---------------------------------------------------------------------------

async function extractText(bytes: Uint8Array): Promise<string> {
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

async function checkHighlightsDoNotAlterText() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("Total First Bank Accounts", { x: 36, y: 519, size: 8.5, font: bold });
  const beforeText = await extractText(await pdf.save());

  applyHighlights(page, bold, {
    first_bank_accounts: money(35126.77),
    aging_vendors_consolidated: money(20905.79),
    aging_customers_consolidated: money(16658.08),
  });
  const afterBytes = await pdf.save();
  const afterText = await extractText(afterBytes);

  assert.equal(afterText, beforeText, "applyHighlights no debe cambiar el texto extraíble de la página");
  return afterBytes;
}

async function main() {
const highlightedBytes = await checkHighlightsDoNotAlterText();
console.log("applyHighlights no altera el texto extraíble (comparado con pdf-parse) -- OK.");

assert.equal(money(35126.77), "$35,126.77");
assert.equal(money(20905.79), "$20,905.79");
assert.equal(money(16658.08), "$16,658.08");
assert.deepEqual(
  DEFAULT_PACKAGE_HIGHLIGHTS.map((h) => h.key).sort(),
  ["aging_customers_consolidated", "aging_vendors_consolidated", "first_bank_accounts"].sort(),
  "la lista de cifras resaltadas por defecto es Total First Bank Accounts, Aging Vendors y Aging Customers consolidados",
);
console.log(
  "Caso de validación del 09/10/2026 (35,126.77 / 20,905.79 / 16,658.08) formateado igual que la portada -- OK.",
);

// ---------------------------------------------------------------------------
// render.ts: PNG válido, ancho mínimo, sin recortar márgenes
// ---------------------------------------------------------------------------

const rendered = await renderPdfPageToPng(highlightedBytes, 1, 1600);
assert.ok(rendered.width >= 1600, `ancho de la portada (${rendered.width}) debe ser >= 1600px`);
assert.equal(rendered.png[0], 0x89, "firma PNG (primer byte)");
assert.equal(rendered.png[1], 0x50, "firma PNG (segundo byte, 'P')");
assert.equal(rendered.png[2], 0x4e, "firma PNG (tercer byte, 'N')");
assert.equal(rendered.png[3], 0x47, "firma PNG (cuarto byte, 'G')");
console.log(`Portada renderizada a PNG válido, ${rendered.width}x${rendered.height}px (>= 1600px de ancho) -- OK.`);

// ---------------------------------------------------------------------------
// Bloqueo (día cerrado + sin alertas) y acceso (admin genera, Gabriel
// solo lee/descarga -- 403 si Gabriel intenta generar). Estático: el
// `checkPackageEligibility` real necesita un día cargado y cerrado de
// "Informes diarios" en la base; acá se verifica que esté enchufado
// exactamente a las mismas alertas/estado que ya usa ese módulo, y que
// las rutas respeten el control de acceso -- sin cargar datos reales.
// ---------------------------------------------------------------------------

const read = (file: string) => readFileSync(file, "utf8");

const servicesSource = read("src/services/cutmeat-report-packages.ts");
assert.match(
  servicesSource,
  /checkPackageEligibility[\s\S]*?workspace\.report\.status !== "closed"/,
  "checkPackageEligibility exige el día cerrado",
);
assert.match(
  servicesSource,
  /checkPackageEligibility[\s\S]*?additionalWarnings/,
  "checkPackageEligibility suma las mismas alertas de Informes diarios (checkDailyReportCompleteness)",
);
assert.match(
  servicesSource,
  /buildAndStorePackage[\s\S]*?if \(!eligibility\.eligible\) throw new PackageNotEligibleError/,
  "buildAndStorePackage se bloquea si no es elegible",
);
assert.match(
  servicesSource,
  /version = \(latestVersion\?\.version \?\? 0\) \+ 1/,
  "cada generación crea una versión nueva, nunca pisa la anterior",
);
assert.match(
  servicesSource,
  /No modificar|PACKAGE_DOC_TYPES/,
);
assert.doesNotMatch(
  read("src/lib/cutmeat-daily/pdf.ts"),
  /applyHighlights|cutmeat_report_packages/,
  "los 5 builders de PDF individuales no se tocan para armar el paquete",
);

const pdfRouteSource = read(
  "src/app/api/cutmeat-reports/[companyId]/[reportDate]/package/pdf/route.ts",
);
assert.match(
  pdfRouteSource,
  /export async function POST[\s\S]*?profile\.role !== "admin"[\s\S]*?status: 403/,
  "POST (generar) devuelve 403 si el que llama no es admin -- Gabriel no puede generar",
);
assert.match(
  pdfRouteSource,
  /export async function GET[\s\S]*?isOwnClient = profile\.role === "client"[\s\S]*?!isAdmin && !isOwnClient/,
  "GET (descargar) deja entrar a admin o al cliente de esta empresa (Gabriel)",
);
const coverRouteSource = read(
  "src/app/api/cutmeat-reports/[companyId]/[reportDate]/package/cover/route.ts",
);
assert.match(
  coverRouteSource,
  /isOwnClient = profile\.role === "client"[\s\S]*?!isAdmin && !isOwnClient/,
  "la descarga de la portada también deja entrar a Gabriel",
);
assert.doesNotMatch(
  coverRouteSource,
  /export async function POST/,
  "la portada nunca se genera sola -- no tiene su propio POST, se genera junto con el paquete",
);

console.log(
  "Bloqueo (día cerrado + sin alertas) enchufado a Informes diarios, y acceso " +
    "(admin genera/regenera, Gabriel 403 al generar pero puede descargar) -- OK.",
);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
