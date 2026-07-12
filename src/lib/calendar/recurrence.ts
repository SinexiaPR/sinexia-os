import type { CalendarItem, RecurrenceRule } from "@/types/calendar";

const DAY_MS = 86_400_000;

export function parseDate(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function isLastBusinessDay(date: Date) {
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) return false;
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getUTCMonth() !== date.getUTCMonth();
}

export function occursOn(
  startDate: string,
  date: string,
  rule: RecurrenceRule,
) {
  const start = parseDate(startDate);
  const current = parseDate(date);
  if (current < start) return false;

  if (rule.frequency === "weekly") return daysBetween(start, current) % 7 === 0;
  if (rule.frequency === "biweekly")
    return daysBetween(start, current) % 14 === 0;
  if (rule.frequency === "weekdays") {
    const weekdays = rule.weekdays?.length
      ? rule.weekdays
      : [start.getUTCDay()];
    return weekdays.includes(current.getUTCDay());
  }
  if (rule.monthlyMode === "last_business_day")
    return isLastBusinessDay(current);
  return current.getUTCDate() === start.getUTCDate();
}

export function expandCalendarItems(
  items: CalendarItem[],
  from: string,
  to: string,
) {
  const expanded: CalendarItem[] = [];
  const rangeStart = parseDate(from);
  const rangeEnd = parseDate(to);

  for (const item of items) {
    if (!item.recurrenceRule) {
      if (item.eventDate >= from && item.eventDate <= to) expanded.push(item);
      continue;
    }
    for (
      let cursor = new Date(rangeStart);
      cursor <= rangeEnd;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const date = formatDate(cursor);
      if (item.recurrenceUntil && date > item.recurrenceUntil) break;
      if (occursOn(item.eventDate, date, item.recurrenceRule)) {
        expanded.push({ ...item, occurrenceDate: date });
      }
    }
  }
  return expanded;
}

export function sortCalendarItems(items: CalendarItem[], today: string) {
  const priority = { urgent: 0, important: 1, routine: 2 };
  const status = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
  return [...items].sort((a, b) => {
    const aOverdue =
      a.occurrenceDate < today &&
      a.status !== "completed" &&
      a.status !== "cancelled";
    const bOverdue =
      b.occurrenceDate < today &&
      b.status !== "completed" &&
      b.status !== "cancelled";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (aOverdue && bOverdue && priority[a.priority] !== priority[b.priority])
      return priority[a.priority] - priority[b.priority];
    if (a.occurrenceDate !== b.occurrenceDate)
      return a.occurrenceDate.localeCompare(b.occurrenceDate);
    return status[a.status] - status[b.status];
  });
}
