// Plan de armado del "Paquete para el dueño" de Cut Meat Distributors
// (Wagyu Food Service LLC): un solo PDF que une los 5 informes del día,
// con la portada (última hoja del Consolidado) primero. Puro -- no abre
// ni lee ningún PDF, solo decide QUÉ página de QUÉ documento va en qué
// posición, a partir de cuántas páginas tiene cada uno.
//
// El conteo de páginas nunca se hardcodea: Aging Customers varía según
// facturas abiertas, así que todo se calcula a partir de pageCounts.

export type PackageSourceDoc =
  | "reconciliation"
  | "bank"
  | "consolidated"
  | "vendors"
  | "customers";

export type PackagePageCounts = Record<PackageSourceDoc, number>;

export type PackagePlanStep = {
  doc: PackageSourceDoc;
  /** Índices de página (0-based) del PDF origen, en el orden en que se
   * copian al paquete. */
  pageIndexes: number[];
  /** true solo para el paso que es la portada (última hoja del
   * Consolidado, movida al frente). */
  isCover?: boolean;
};

export type PackagePlan = {
  steps: PackagePlanStep[];
  totalPages: number;
};

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/**
 * Orden del paquete: portada (última hoja del Consolidado) -> Reconciliation
 * Report -> Export -> Consolidado SIN su última hoja (ya es la portada, no
 * se repite) -> Aging Vendors -> Aging Customers.
 *
 * El total de páginas del paquete es siempre la suma de páginas de los 5
 * PDF individuales: la portada se reutiliza, nunca se duplica.
 */
export function buildPackagePlan(pageCounts: PackagePageCounts): PackagePlan {
  for (const [doc, count] of Object.entries(pageCounts)) {
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`"${doc}" necesita al menos 1 página (tiene ${count}).`);
    }
  }
  const coverIndex = pageCounts.consolidated - 1;
  const consolidatedWithoutCover = range(pageCounts.consolidated - 1);

  const steps: PackagePlanStep[] = [
    { doc: "consolidated", pageIndexes: [coverIndex], isCover: true },
    { doc: "reconciliation", pageIndexes: range(pageCounts.reconciliation) },
    { doc: "bank", pageIndexes: range(pageCounts.bank) },
    { doc: "consolidated", pageIndexes: consolidatedWithoutCover },
    { doc: "vendors", pageIndexes: range(pageCounts.vendors) },
    { doc: "customers", pageIndexes: range(pageCounts.customers) },
  ];

  const totalPages = steps.reduce((sum, step) => sum + step.pageIndexes.length, 0);
  return { steps, totalPages };
}
