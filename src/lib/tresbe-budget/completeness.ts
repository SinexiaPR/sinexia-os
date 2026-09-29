// Chequeo de completitud de una semana antes de imprimirla o exportarla.
//
// El reporte no debe mostrar una celda en $0/en blanco cuando en realidad no
// hay dato cargado -- eso se confunde con "no hubo venta ese día". Este
// módulo separa "dato ausente" de "dato en cero real" y devuelve avisos
// explícitos para lo que falta, en vez de dejarlo pasar en silencio.

import type { CashControlLike, CategoryLike } from "./calculations";
import { formatDayLabel, isoWeekday, type IsoDate } from "./dates";

export type MovementForCompleteness = {
  entry_date: IsoDate;
  category_id: string;
};

export type ClosedDayForCompleteness = {
  entry_date: IsoDate;
  category_id: string;
};

// Categorías de ingreso diario que deben tener un movimiento (aunque sea
// $0 explícito) los 7 días de la semana para que el reporte no tenga huecos.
const DAILY_INCOME_CODES = ["cash_disponible", "credit_card_disponible"];

// Credit Card Disponible se carga por fecha de DEPOSITO bancario (EFT
// Banktech), no por fecha de venta. El banco no procesa depositos en fin de
// semana, asi que sabado y domingo estructuralmente nunca tienen un deposito
// propio ese mismo dia -- el dinero de esos dos dias entra recien el lunes
// siguiente (o mas tarde), agrupado con otros depositos. No es un hueco
// real, es el diseño del proceso; se excluye del chequeo dia por dia.
const WEEKEND_SETTLEMENT_EXEMPT_CODES = new Set(["credit_card_disponible"]);

const CASH_CONTROL_FIELDS: Array<{
  field: keyof NonNullable<CashControlLike>;
  label: string;
}> = [
  { field: "actual_bank_balance", label: "Saldo Banco Real" },
  { field: "actual_cash_balance", label: "Saldo Cash Real" },
  { field: "minimum_cash_target", label: "Mínimo de Caja objetivo" },
];

export function checkWeekCompleteness({
  dates,
  categories,
  movements,
  closedDays = [],
  cashControl,
}: {
  dates: IsoDate[];
  categories: CategoryLike[];
  movements: MovementForCompleteness[];
  closedDays?: ClosedDayForCompleteness[];
  cashControl: CashControlLike;
}): string[] {
  const warnings: string[] = [];
  const categoryByCode = new Map(categories.map((item) => [item.code, item]));
  const closedKeys = new Set(
    closedDays.map((row) => `${row.category_id}|${row.entry_date}`),
  );

  for (const code of DAILY_INCOME_CODES) {
    const category = categoryByCode.get(code);
    if (!category) continue;
    const datesWithMovement = new Set(
      movements
        .filter((movement) => movement.category_id === category.id)
        .map((movement) => movement.entry_date),
    );
    const weekendExempt = WEEKEND_SETTLEMENT_EXEMPT_CODES.has(code);
    for (const date of dates) {
      if (datesWithMovement.has(date)) continue;
      if (closedKeys.has(`${category.id}|${date}`)) continue;
      if (weekendExempt && (isoWeekday(date) === 6 || isoWeekday(date) === 7)) {
        continue;
      }
      warnings.push(`Falta: ${category.name} del ${formatDayLabel(date)}`);
    }
  }

  if (!cashControl) {
    warnings.push(
      "Falta: fila de Control de Caja (tresbe_budget_cash_control) para esta semana",
    );
  } else {
    for (const { field, label } of CASH_CONTROL_FIELDS) {
      if (cashControl[field] == null) {
        warnings.push(`Falta: ${label} en Control de Caja de esta semana`);
      }
    }
  }

  return warnings;
}
