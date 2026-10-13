// Motor puro de "Recurrentes" de Cut Meat Distributors (Wagyu Food Service
// LLC) -- reemplaza la columna "Pagado" (el "1" de la columna L) del Google
// Sheet mensual. Puro y sin efectos de lado; todo lo que toca Supabase vive
// en services/actions. Reutiliza los helpers de fecha de
// src/lib/cutmeat-daily/dates.ts (semana domingo-sábado, igual convención
// que el resto de "Informes diarios") en vez de duplicarlos.

import { addDays, sundayWeekStartOf, type IsoDate } from "@/lib/cutmeat-daily/dates";

const round = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => round(values.reduce((a, b) => a + b, 0));

export type Recurrente = {
  id: string;
  vendor: string;
  dueDate: IsoDate | null;
  amount: number;
  pagado: boolean;
  paidAmount?: number | null;
};

/**
 * En qué semana (domingo a sábado) cae el vencimiento de un recurrente,
 * relativo a la semana de `referenceDate`: "antes" si es de una semana ya
 * pasada, "sin_fecha" si no tiene due_date, o el domingo (IsoDate) de su
 * propia semana en caso contrario.
 */
export function weekBucket(
  dueDate: IsoDate | null,
  referenceDate: IsoDate,
): "antes" | "sin_fecha" | IsoDate {
  if (!dueDate) return "sin_fecha";
  const referenceWeekStart = sundayWeekStartOf(referenceDate);
  if (dueDate < referenceWeekStart) return "antes";
  return sundayWeekStartOf(dueDate);
}

export type WeekTotal = { weekStart: IsoDate; weekEnd: IsoDate; total: number };

export type TotalsByWeekResult = {
  /** Pendientes con vencimiento antes del domingo de la semana de referencia. */
  prior: number;
  /** `weeksAhead` semanas a partir de la semana de referencia (inclusive). */
  weeks: WeekTotal[];
  /** Pendientes sin due_date (no se pueden ubicar en ninguna semana). */
  sinFecha: number;
  /** prior + todas las semanas + sinFecha. */
  total: number;
};

/**
 * Totales de recurrentes PENDIENTES (pagado = false) por semana. Un
 * recurrente pagado nunca suma -- "sale del pendiente" apenas se marca.
 */
export function totalsByWeek(
  recurrentes: Recurrente[],
  referenceDate: IsoDate,
  weeksAhead = 3,
): TotalsByWeekResult {
  const pending = recurrentes.filter((r) => !r.pagado);
  const referenceWeekStart = sundayWeekStartOf(referenceDate);

  const prior = sum(
    pending
      .filter((r) => r.dueDate != null && r.dueDate < referenceWeekStart)
      .map((r) => r.amount),
  );
  const sinFecha = sum(pending.filter((r) => r.dueDate == null).map((r) => r.amount));

  const weeks: WeekTotal[] = Array.from({ length: weeksAhead }, (_, index) => {
    const weekStart = addDays(referenceWeekStart, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const total = sum(
      pending
        .filter((r) => r.dueDate != null && r.dueDate >= weekStart && r.dueDate <= weekEnd)
        .map((r) => r.amount),
    );
    return { weekStart, weekEnd, total };
  });

  const total = round(prior + sinFecha + weeks.reduce((acc, w) => acc + w.total, 0));
  return { prior, weeks, sinFecha, total };
}

/**
 * Transforma un recurrente al marcarlo pagado/pendiente. Desmarcar pagado
 * limpia la fecha y el monto real -- vuelve a ser deuda pendiente sin
 * rastro de un pago que ya no existe. Si se marca pagado sin un monto real
 * distinto informado, se asume que coincidió con el monto recurrente (sin
 * variación), nunca se deja "amount" como si no se hubiera pagado nada.
 */
export function markPaid<T extends Recurrente>(
  recurrente: T,
  input: { paid: boolean; paidDate?: IsoDate | null; paidAmount?: number | null },
): T & { paidDate: IsoDate | null; paidAmount: number | null } {
  if (!input.paid) {
    return { ...recurrente, pagado: false, paidDate: null, paidAmount: null };
  }
  return {
    ...recurrente,
    pagado: true,
    paidDate: input.paidDate ?? null,
    paidAmount: input.paidAmount ?? recurrente.amount,
  };
}

/**
 * Recurrentes pendientes cuyo vencimiento ya llegó o pasó respecto de
 * `asOfDate`, pero que todavía no se confirmaron contra el banco /
 * QuickBooks -- la lista "por confirmar" de la actualización del 12/10.
 */
export function pendingToConfirm(
  recurrentes: Recurrente[],
  asOfDate: IsoDate,
): Recurrente[] {
  return recurrentes.filter(
    (r) => !r.pagado && r.dueDate != null && r.dueDate <= asOfDate,
  );
}

/**
 * Diferencia entre el monto recurrente y el monto real pagado (para
 * Variación Diaria): positivo = se pagó menos de lo esperado (favorable).
 * Un recurrente pagado sin monto real informado no aporta variación.
 */
export function paidVariance(recurrente: Recurrente): number | null {
  if (!recurrente.pagado || recurrente.paidAmount == null) return null;
  return round(recurrente.amount - recurrente.paidAmount);
}

/** Misma fecha, `monthsForward` meses después (para "Copiar recurrentes del
 * mes anterior"). Los recurrentes de este módulo caen siempre entre el día
 * 1 y el 16, así que no hace falta manejar desborde de fin de mes. */
export function shiftPeriod(date: IsoDate, monthsForward = 1): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1 + monthsForward, day));
  return shifted.toISOString().slice(0, 10);
}
