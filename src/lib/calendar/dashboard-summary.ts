import type { CalendarItem } from "@/types/calendar";

const priorityOrder = { urgent: 0, important: 1, routine: 2 };

export function getTodayItemsForAdmin(
  items: CalendarItem[],
  adminId: string,
  today: string,
) {
  return items
    .filter(
      (item) =>
        item.occurrenceDate === today &&
        (item.assignedTo === adminId || item.assignedTo === null) &&
        (item.status === "pending" || item.status === "in_progress"),
    )
    .sort((a, b) => {
      const byPriority = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (byPriority !== 0) return byPriority;
      const byTime = (a.startAt ?? "").localeCompare(b.startAt ?? "");
      return byTime || a.title.localeCompare(b.title, "es");
    });
}

export function getAdminFirstName(fullName: string | null, email: string) {
  return (
    fullName?.trim().split(/\s+/)[0] ||
    email.split("@")[0] ||
    "equipo"
  ).trim();
}

export function getCalendarItemLabel(item: CalendarItem) {
  if (!item.companyName) return item.title;
  return item.title
    .toLocaleLowerCase("es")
    .includes(item.companyName.toLocaleLowerCase("es"))
    ? item.title
    : `${item.title} · ${item.companyName}`;
}
