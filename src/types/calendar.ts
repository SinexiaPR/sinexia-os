export type CalendarItemType =
  "task" | "activity" | "reminder" | "internal_message";
export type CalendarPriority = "routine" | "important" | "urgent";
export type CalendarStatus =
  "pending" | "in_progress" | "completed" | "cancelled";
export type RecurrenceFrequency =
  "weekly" | "biweekly" | "monthly" | "weekdays";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  weekdays?: number[];
  monthlyMode?: "same_day" | "last_business_day";
};

export type CalendarItem = {
  id: string;
  title: string;
  description: string | null;
  itemType: CalendarItemType;
  companyId: string | null;
  companyName: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  eventDate: string;
  occurrenceDate: string;
  allDay: boolean;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  priority: CalendarPriority;
  status: CalendarStatus;
  recurrenceRule: RecurrenceRule | null;
  recurrenceUntil: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarComment = {
  id: string;
  calendarItemId: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type CalendarOption = { id: string; name: string };
