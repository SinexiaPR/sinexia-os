import assert from "node:assert/strict";

import { buildAgenda } from "../src/lib/calendar/agenda";
import type { CalendarItem } from "../src/types/calendar";

function item(
  partial: Partial<CalendarItem> & { id: string; occurrenceDate: string },
): CalendarItem {
  return {
    title: "Actividad",
    itemType: "activity",
    recurrenceRule: null,
    status: "pending",
    priority: "routine",
    ...partial,
  } as CalendarItem;
}

const weekly = { frequency: "weekly" as const };
const items: CalendarItem[] = [
  item({ id: "past", occurrenceDate: "2026-10-20" }),
  item({
    id: "nomina",
    title: "NOMINA SIBARITA",
    occurrenceDate: "2026-10-28",
    recurrenceRule: weekly,
  }),
  item({
    id: "nomina",
    title: "NOMINA SIBARITA",
    occurrenceDate: "2026-11-04",
    recurrenceRule: weekly,
  }),
  item({
    id: "nomina",
    title: "NOMINA SIBARITA",
    occurrenceDate: "2026-11-11",
    recurrenceRule: weekly,
  }),
  item({
    id: "nomina",
    title: "NOMINA SIBARITA",
    occurrenceDate: "2026-12-30",
    recurrenceRule: weekly,
  }),
  item({ id: "junta", title: "Junta", occurrenceDate: "2026-10-30" }),
  item({ id: "lejos", occurrenceDate: "2027-02-01" }),
  item({
    id: "t1",
    itemType: "task",
    occurrenceDate: "2026-11-02",
    recurrenceRule: weekly,
  }),
  item({
    id: "t1",
    itemType: "task",
    occurrenceDate: "2026-11-09",
    recurrenceRule: weekly,
  }),
];

const agenda = buildAgenda(items, "2026-10-28");

assert.deepEqual(
  agenda.map((e) => `${e.kind}:${e.item.id}:${e.item.occurrenceDate}`),
  [
    "series:nomina:2026-10-28",
    "single:junta:2026-10-30",
    "single:t1:2026-11-02",
    "single:t1:2026-11-09",
  ],
  "una sola entrada por serie, sin pasado ni más allá de 30 días; tareas individuales",
);
const series = agenda[0];
assert.equal(
  series.kind === "series" && series.count,
  3,
  "3 ocurrencias en la ventana (28 oct, 4 y 11 nov)",
);

assert.deepEqual(buildAgenda([], "2026-10-28"), []);
// 30 días exactos incluidos: 28 oct + 30 = 27 nov
assert.equal(
  buildAgenda([item({ id: "x", occurrenceDate: "2026-11-27" })], "2026-10-28")
    .length,
  1,
);
assert.equal(
  buildAgenda([item({ id: "x", occurrenceDate: "2026-11-28" })], "2026-10-28")
    .length,
  0,
);

console.log("Calendar agenda window and series grouping: PASS");
