// Alertas en pantalla del día, mismo espíritu que completeness.ts de
// Tresbe: separar "no cuadra" / "falta clasificar" de un silencio que se
// confunde con "todo bien".

import type {
  AgingLine,
  BankMovement,
  ReconciliationControlResult,
  RecurringPayment,
} from "./calculations";
import {
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

export function checkDailyReportCompleteness({
  reportDate,
  reconciliationControl,
  bankMovements,
  recurring,
  vendorAgingItems,
  vendorAgingConfig,
  sources,
}: {
  reportDate: IsoDate;
  reconciliationControl: ReconciliationControlResult | null;
  bankMovements: BankMovement[];
  recurring: RecurringPayment[];
  vendorAgingItems: AgingLine[];
  vendorAgingConfig: VendorAgingConfig;
  sources: DailyReportSources;
}): string[] {
  const warnings: string[] = [];

  if (!sources.hasReconciliation) {
    warnings.push("Falta cargar el Reconciliation Report de QuickBooks.");
  } else if (reconciliationControl && !reconciliationControl.balanced) {
    warnings.push(
      `El control de conciliación no da $0.00 (diferencia: ${reconciliationControl.control.toFixed(2)}).`,
    );
  }
  if (!sources.hasBankExport) {
    warnings.push("Falta cargar el export del banco (PDF).");
  }
  if (!sources.hasVendorAging) {
    warnings.push("Falta cargar el Vendor Balance Detail Report.");
  }
  if (!sources.hasCustomerAging) {
    warnings.push("Falta cargar el Customer Balance Detail Report.");
  }

  const { unclassified } = classifyBankMovements(bankMovements);
  for (const movement of unclassified) {
    warnings.push(
      `Movimiento del banco sin clasificar: "${movement.description}" (${movement.amount.toFixed(2)}).`,
    );
  }

  for (const item of overdueUnpaidRecurring(recurring, reportDate)) {
    warnings.push(
      `Recurrente vencido sin pago: ${item.concept}, vencía el ${formatDayLabel(item.dueDate)}.`,
    );
  }

  const unconfiguredVendors = findUnconfiguredVendors(
    vendorAgingItems,
    vendorAgingConfig,
  );
  for (const vendor of unconfiguredVendors) {
    warnings.push(
      `Proveedor nuevo en el aging, sin configurar como incluido ni excluido: ${vendor.name}.`,
    );
  }

  return warnings;
}
