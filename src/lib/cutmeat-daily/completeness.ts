// Alertas en pantalla del día, mismo espíritu que completeness.ts de
// Tresbe: separar "no cuadra" / "falta clasificar" de un silencio que se
// confunde con "todo bien".

import type {
  AgingLine,
  BankMovement,
  FinancialReportResult,
  ReconciliationControlResult,
  RecurringBucket,
  RecurringPayment,
  VarianceLine,
  WeeklyPaymentsResult,
} from "./calculations";
import {
  buildFinancialReport,
  checkVarianceReconciliation,
  classifyBankMovements,
  findUnconfiguredVendors,
  overdueUnpaidRecurring,
  round,
  type VendorAgingConfig,
} from "./calculations";
import { formatDayLabel, type IsoDate } from "./dates";

export type DailyReportSources = {
  hasReconciliation: boolean;
  hasBankExport: boolean;
  hasVendorAging: boolean;
  hasCustomerAging: boolean;
};

/** "blocking": no se puede cerrar el día ni armar el Paquete para el
 * dueño mientras exista una (control de conciliación distinto de
 * $0.00, proveedor nuevo sin clasificar, movimiento del banco sin
 * clasificar, o una fuente de datos todavía no cargada). "info": se
 * muestra igual en pantalla, pero no bloquea nada -- hoy solo
 * "recurrente vencido sin pago", que es el bucket normal "Prior + This
 * week" (ya descontado del Balance after Weekly Payments), no un error. */
export type DailyReportWarning = {
  severity: "blocking" | "info";
  message: string;
};

export function checkDailyReportCompleteness({
  reportDate,
  reconciliationControl,
  bankMovements,
  recurring,
  vendorAgingItems,
  vendorAgingConfig,
  sources,
  varianceReconciliation,
  weeklyPayments,
  financial,
  buckets,
  currentWeekIncome,
  flatWeeklyIncome,
}: {
  reportDate: IsoDate;
  reconciliationControl: ReconciliationControlResult | null;
  bankMovements: BankMovement[];
  recurring: RecurringPayment[];
  vendorAgingItems: AgingLine[];
  vendorAgingConfig: VendorAgingConfig;
  sources: DailyReportSources;
  /** Datos para la ecuación de control de la Variación Diaria (Balance
   * Today = Gabriel + variación de cheques/pagos + variación de
   * depósitos + Depósitos del día) -- null mientras falte alguno (p.ej.
   * todavía no hay conciliación cargada, o no hay un día cerrado
   * anterior), caso en el que este control simplemente no corre. */
  varianceReconciliation: {
    balanceGabriel: number;
    varianceLines: VarianceLine[];
    notEnteredDepositsTotal: number;
    balanceToday: number;
  } | null;
  /** Controles automáticos del paquete (se ejecutan antes de armarlo,
   * reusando exactamente los mismos números ya calculados del workspace
   * -- nunca un segundo cálculo independiente). Todos opcionales/null
   * mientras falte el dato correspondiente, caso en el que ese control
   * puntual simplemente no corre (no bloquea por sí solo). */
  weeklyPayments?: WeeklyPaymentsResult | null;
  financial?: FinancialReportResult | null;
  buckets?: {
    prior: RecurringBucket;
    thisWeek: RecurringBucket;
    nextWeek: RecurringBucket;
    weekAfter: RecurringBucket;
  } | null;
  currentWeekIncome?: number | null;
  flatWeeklyIncome?: number | null;
}): DailyReportWarning[] {
  const warnings: DailyReportWarning[] = [];
  const blocking = (message: string) => warnings.push({ severity: "blocking", message });
  const info = (message: string) => warnings.push({ severity: "info", message });

  if (!sources.hasReconciliation) {
    blocking("Falta cargar el Reconciliation Report de QuickBooks.");
  } else if (reconciliationControl && !reconciliationControl.balanced) {
    blocking(
      `El control de conciliación no da $0.00 (diferencia: ${reconciliationControl.control.toFixed(2)}).`,
    );
  }

  if (varianceReconciliation) {
    const { balanceGabriel, varianceLines, notEnteredDepositsTotal, balanceToday } = varianceReconciliation;
    const result = checkVarianceReconciliation(
      balanceGabriel,
      varianceLines,
      notEnteredDepositsTotal,
      balanceToday,
    );
    if (!result.balanced) {
      blocking(
        `Hay un movimiento sin clasificar: Balance GABRIEL + Variación Diaria + Depósitos del día da ` +
          `${result.expected.toFixed(2)}, pero el Balance Today (Register) da ${balanceToday.toFixed(2)} ` +
          `(diferencia: ${result.difference.toFixed(2)}).`,
      );
    }
    for (const line of varianceReconciliation.varianceLines) {
      if (line.section !== "variance" && line.section !== "uncollected_deposit") {
        blocking(
          `Variación Diaria: la línea "${line.concept}" no tiene una sección válida (checks o depósitos).`,
        );
      }
    }
  }

  // Balance after Weekly Payments = Register − recurrentes anteriores −
  // recurrentes de esta semana (nunca un número suelto, siempre
  // recalculado desde el mismo Register y los mismos buckets que
  // alimentan el PDF).
  if (weeklyPayments && financial) {
    const expectedBalanceToday = round(
      weeklyPayments.register - weeklyPayments.recurrentesPrior - weeklyPayments.recurrentesThisWeek,
    );
    if (round(financial.balanceToday) !== expectedBalanceToday) {
      blocking(
        `Balance after Weekly Payments (${financial.balanceToday.toFixed(2)}) no coincide con Register − recurrentes anteriores − recurrentes de esta semana (${expectedBalanceToday.toFixed(2)}).`,
      );
    }
  }
  // El Register que alimenta Balance after Weekly Payments tiene que ser
  // el mismo que el del Reconciliation Report -- si diverge, alguna
  // hoja del paquete quedaría con un número que las demás no respaldan.
  if (
    reconciliationControl &&
    weeklyPayments &&
    round(reconciliationControl.register) !== round(weeklyPayments.register)
  ) {
    blocking(
      `El Register usado en Balance after Weekly Payments (${weeklyPayments.register.toFixed(2)}) no coincide con el del Reconciliation Report (${reconciliationControl.register.toFixed(2)}).`,
    );
  }
  // Saldos 7/14/21 días: se recalculan desde cero con los mismos
  // insumos (B, ingresos, recurrentes de cada semana) y se comparan
  // contra los que trae el Financial Report -- si no coinciden, algo
  // quedó calculado con datos viejos.
  if (financial && weeklyPayments && buckets && currentWeekIncome != null && flatWeeklyIncome != null) {
    const recomputed = buildFinancialReport({
      reportDate,
      balanceAfterWeeklyPayments: weeklyPayments.balanceAfterWeeklyPayments,
      currentWeekIncome,
      nextWeekBuckets: { total: buckets.nextWeek.total },
      weekAfterBuckets: { total: buckets.weekAfter.total },
      flatWeeklyIncome,
    });
    if (
      round(recomputed.day7.balance) !== round(financial.day7.balance) ||
      round(recomputed.day14.balance) !== round(financial.day14.balance) ||
      round(recomputed.day21.balance) !== round(financial.day21.balance)
    ) {
      blocking(
        "Los saldos 7/14/21 días del Financial Report no son consistentes con el Balance after Weekly Payments y los recurrentes de cada semana.",
      );
    }
  }

  if (!sources.hasBankExport) {
    blocking("Falta cargar el export del banco (PDF).");
  }
  if (!sources.hasVendorAging) {
    blocking("Falta cargar el Vendor Balance Detail Report.");
  }
  if (!sources.hasCustomerAging) {
    blocking("Falta cargar el Customer Balance Detail Report.");
  }

  const { unclassified } = classifyBankMovements(bankMovements);
  for (const movement of unclassified) {
    blocking(
      `Movimiento del banco sin clasificar: "${movement.description}" (${movement.amount.toFixed(2)}).`,
    );
  }

  for (const item of overdueUnpaidRecurring(recurring, reportDate)) {
    info(
      `Recurrente vencido sin pago: ${item.concept}, vencía el ${formatDayLabel(item.dueDate)}.`,
    );
  }

  const unconfiguredVendors = findUnconfiguredVendors(
    vendorAgingItems,
    vendorAgingConfig,
  );
  for (const vendor of unconfiguredVendors) {
    blocking(
      `Proveedor nuevo en el aging, sin configurar como incluido ni excluido: ${vendor.name}.`,
    );
  }

  return warnings;
}
