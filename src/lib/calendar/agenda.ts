import type { CalendarItem, RecurrenceFrequency } from "@/types/calendar";

export const AGENDA_DAYS = 30;

export type AgendaEntry =
  | { kind: "single"; item: CalendarItem }
  | {
      kind: "series";
      /** Próxima ocurrencia dentro de la ventana. */
      item: CalendarItem;
      /** Cuántas veces ocurre dentro de la ventana. */
      count: number;
    };

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  weekly: "Cada semana",
  biweekly: "Cada dos semanas",
  monthly: "Cada mes",
  weekdays: "Días laborables",
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/**
 * Agenda de los próximos `days` días a partir de `today`. Las series
 * repetidas (misma actividad con regla de recurrencia) se muestran como una
 * sola entrada con su próxima ocurrencia; las tareas siguen individuales para
 * poder completarlas en bloque.
 */
export function buildAgenda(
  items: CalendarItem[],
  today: string,
  days = AGENDA_DAYS,
): AgendaEntry[] {
  const end = addDays(today, days);
  const inWindow = items
    .filter(
      (item) => item.occurrenceDate >= today && item.occurrenceDate <= end,
    )
    .sort(
      (a, b) =>
        a.occurrenceDate.localeCompare(b.occurrenceDate) ||
        a.title.localeCompare(b.title, "es"),
    );

  const entries: AgendaEntry[] = [];
  const seriesIndex = new Map<string, number>();
  for (const item of inWindow) {
    if (!item.recurrenceRule || item.itemType === "task") {
      entries.push({ kind: "single", item });
      continue;
    }
    const existing = seriesIndex.get(item.id);
    if (existing === undefined) {
      seriesIndex.set(item.id, entries.length);
      entries.push({ kind: "series", item, count: 1 });
    } else {
      const entry = entries[existing];
      if (entry.kind === "series") entry.count += 1;
    }
  }
  return entries;
}
