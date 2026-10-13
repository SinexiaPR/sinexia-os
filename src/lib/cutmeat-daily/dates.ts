// Fechas del módulo "Informes diarios" de Cut Meat Distributors.
//
// A diferencia del presupuesto de Tresbe (semana lunes-domingo), este
// módulo sigue el convenio de la planilla original: semana domingo a
// sábado, por fecha de vencimiento de cada recurrente.

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

/** true para sábado (6) o domingo (7). */
export function isWeekend(value: IsoDate): boolean {
  const weekday = isoWeekday(value);
  return weekday === 6 || weekday === 7;
}

/** Domingo de la semana que contiene la fecha (semana domingo-sábado). */
export function sundayWeekStartOf(value: IsoDate): IsoDate {
  return addDays(value, -(isoWeekday(value) % 7));
}

export function weekDatesSundayToSaturday(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/**
 * Último día hábil cerrado antes (o en) la fecha dada, saltando fines de
 * semana y los feriados configurados. Se usa para sugerir la fecha del
 * informe: el consolidado armado el lunes 12/10 sugiere el viernes 10/09.
 */
export function lastBusinessDayBefore(
  value: IsoDate,
  holidays: Set<IsoDate>,
): IsoDate {
  let cursor = addDays(value, -1);
  while (isWeekend(cursor) || holidays.has(cursor)) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

export function todayInPuertoRico(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const dayFormat = new Intl.DateTimeFormat("es-PR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export function formatDayLabel(value: IsoDate) {
  return dayFormat.format(toDate(value));
}

/** MM-DD-YYYY, para los nombres de archivo de los PDF. */
export function formatMDY(value: IsoDate, separator = "-") {
  const [year, month, day] = value.split("-");
  return `${month}${separator}${day}${separator}${year}`;
}

/** MM/DD/YYYY -- formato de fecha de Hernan en los 5 PDF (nunca "lun, 7
 * sept"), tanto para encabezados como para columnas de fecha en tablas. */
export function formatSlashDate(value: IsoDate): string {
  return formatMDY(value, "/");
}

const spanishMonthFormat = new Intl.DateTimeFormat("es-PR", {
  month: "long",
  timeZone: "UTC",
});

/** "04 de Octubre" -- rango de fechas del Financial Report (Weekly income
 * projection / Recurrentes for next N days / Total Agin at), con el mes
 * en mayúscula inicial como lo escribe Hernan. */
export function formatSpanishLongDate(value: IsoDate): string {
  const date = toDate(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = spanishMonthFormat.format(date);
  return `${day} de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

const englishShortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Oct 9, 2026" -- título "As of ..." del Customer Balance Detail Report. */
export function formatEnglishShortDate(value: IsoDate): string {
  return englishShortDateFormat.format(toDate(value));
}

const englishLongDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "October 31, 2026" -- título "As of ..." de A/P Aging Detail Recurrentes. */
export function formatEnglishLongDate(value: IsoDate): string {
  return englishLongDateFormat.format(toDate(value));
}

/** Último día del mes que contiene `value`, como YYYY-MM-DD -- el "As of"
 * del título de A/P Aging Detail Recurrentes (fin del mes vigente). */
export function lastDayOfMonth(value: IsoDate): IsoDate {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month!, 0, 12));
  return toIso(date);
}
