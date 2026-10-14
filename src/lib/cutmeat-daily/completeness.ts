// Alertas en pantalla del día, mismo espíritu que completeness.ts de
// Tresbe: separar "no cuadra" / "falta clasificar" de un silencio que se
// confunde con "todo bien".

import type {
  AgingLine,
  BankMovement,
  ReconciliationControlResult,
  RecurringPayment,
  VarianceLine,
} from "./calculations";
import {
  checkVarianceReconciliation,
  classifyBankMovements,
  findUnconfiguredVendors,
  overdueUnpaidRecurring,
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
