// El dashboard por clientes define "semana actual" como lunes a domingo
// en America/Argentina/Cordoba, por pedido explícito del ticket (distinto
// de la convención America/Puerto_Rico que usan nómina y presupuesto).

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

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(value: IsoDate): number {
  const day = toDate(value).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Lunes de la semana que contiene la fecha. */
export function weekStartOf(value: IsoDate): IsoDate {
  return addDays(value, -(isoWeekday(value) - 1));
}

export function daysBetween(from: IsoDate, to: IsoDate) {
  return Math.round(
    (toDate(to).getTime() - toDate(from).getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function todayInCordoba(): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const dateFormat = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export function formatIsoDate(value: IsoDate) {
  return dateFormat.format(toDate(value));
}
