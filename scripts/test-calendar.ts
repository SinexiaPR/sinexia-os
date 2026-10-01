import assert from "node:assert/strict";

import {
  expandCalendarItems,
  occursOn,
  sortCalendarItems,
} from "../src/lib/calendar/recurrence";
import type { CalendarItem } from "../src/types/calendar";

assert.equal(
  occursOn("2026-07-13", "2026-07-20", { frequency: "weekly" }),
  true,
);
assert.equal(
  occursOn("2026-07-13", "2026-07-27", { frequency: "biweekly" }),
  true,
);
assert.equal(
  occursOn("2026-07-13", "2026-07-14", { frequency: "weekly" }),
  false,
);
assert.equal(
  occursOn("2026-07-01", "2026-07-31", {
    frequency: "monthly",
    monthlyMode: "last_business_day",
  }),
  true,
);

const base: CalendarItem = {
  id: "series",
  title: "Nómina",
  description: null,
  itemType: "task",
  companyId: null,
  companyName: null,
  assignedTo: null,
  assignedName: null,
  createdBy: "admin",
  createdByName: "Admin",
  updatedBy: "admin",
  updatedByName: "Admin",
  eventDate: "2026-07-13",
  occurrenceDate: "2026-07-13",
  allDay: true,
  startAt: null,
  endAt: null,
  timezone: "America/Puerto_Rico",
  priority: "routine",
  status: "pending",
  recurrenceRule: { frequency: "weekly" },
  recurrenceUntil: null,
  completedAt: null,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
};
const expanded = expandCalendarItems([base], "2026-07-13", "2026-08-03");
assert.deepEqual(
  expanded.map((item) => item.occurrenceDate),
  ["2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03"],
);
assert.equal(
  expanded.every(
    (item) => item.startAt === null && item.eventDate === "2026-07-13",
  ),
  true,
  "all-day dates remain date-only",
);

const ordered = sortCalendarItems(
  [
    { ...base, id: "upcoming", occurrenceDate: "2026-07-20" },
    {
      ...base,
      id: "important",
      occurrenceDate: "2026-07-10",
      priority: "important",
    },
    { ...base, id: "urgent", occurrenceDate: "2026-07-11", priority: "urgent" },
  ],
  "2026-07-13",
);
assert.deepEqual(
  ordered.map((item) => item.id),
  ["urgent", "important", "upcoming"],
);

console.log("Calendar recurrence, ordering, and date-only tests passed.");
