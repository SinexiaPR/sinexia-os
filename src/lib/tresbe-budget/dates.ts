// Las fechas del módulo viajan siempre como "YYYY-MM-DD" y se manipulan al
// mediodía UTC para que ningún cambio de huso mueva un día de lugar.

export type IsoDate = string;

function toDate(value: IsoDate) {
  return new Date(`${value}T12:00:00Z`);
}

function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** 1 = lunes … 7 = domingo, igual que ISODOW en Postgres. */
export function isoWeekday(value: IsoDate): number {
  const day = toDate(value).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana operativa que contiene la fecha. */
export function weekStartOf(value: IsoDate): IsoDate {
  return addDays(value, -(isoWeekday(value) - 1));
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function daysBetween(from: IsoDate, to: IsoDate) {
  return Math.round(
    (toDate(to).getTime() - toDate(from).getTime()) / (24 * 60 * 60 * 1000),
  );
}

/** Número de semana dentro del horizonte, contado desde el ancla configurada. */
export function weekNumber(weekOneStart: IsoDate, weekStart: IsoDate) {
  return Math.floor(daysBetween(weekStartOf(weekOneStart), weekStart) / 7) + 1;
}

export function weekStartFromNumber(weekOneStart: IsoDate, number: number) {
  return addDays(weekStartOf(weekOneStart), (number - 1) * 7);
}

export function todayInPuertoRico(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const weekdayNames = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

export function weekdayName(weekday: number) {
  return weekdayNames[weekday - 1] ?? "";
}

const dayLabelFormat = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export function formatDayLabel(value: IsoDate) {
  return dayLabelFormat.format(toDate(value));
}

const rangeFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export function formatWeekRange(weekStart: IsoDate) {
  return `${rangeFormat.format(toDate(weekStart))} – ${rangeFormat.format(
    toDate(addDays(weekStart, 6)),
  )}`;
}
