import Link from "next/link";
import { AlertTriangle, CalendarDays, Circle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getCalendarItemLabel } from "@/lib/calendar/dashboard-summary";
import type { CalendarItem } from "@/types/calendar";

const dateFormat = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function TaskList({
  title,
  items,
  overdue,
}: {
  title: string;
  items: CalendarItem[];
  overdue?: boolean;
}) {
  return (
    <SurfaceCard padding="sm">
      <div className="flex items-center gap-2">
        <CalendarDays className="text-muted-foreground size-4" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="mt-4 space-y-2">
        {items.length ? (
          items.map((item) => (
            <Link
              key={`${item.id}:${item.occurrenceDate}`}
              href={`/dashboard/calendar?item=${item.id}&date=${item.occurrenceDate}`}
              className="hover:border-primary/50 focus-visible:ring-ring/50 flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <span className="truncate">{item.title}</span>
              <span
                className={overdue ? "text-red-700" : "text-muted-foreground"}
              >
                {dateFormat.format(
                  new Date(`${item.occurrenceDate}T12:00:00Z`),
                )}
              </span>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">Sin actividades.</p>
        )}
      </div>
    </SurfaceCard>
  );
}

export function CalendarDashboardWidget({
  items,
  adminName,
  todayItems,
  upcoming,
  overdue,
}: {
  items: CalendarItem[];
  adminName: string;
  todayItems: CalendarItem[];
  upcoming: CalendarItem[];
  overdue: CalendarItem[];
}) {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1, 12));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const days = Array.from({ length: 35 }, (_, index) => {
    const value = new Date(start);
    value.setUTCDate(value.getUTCDate() + index);
    return value;
  });
  const visibleTodayItems = todayItems.slice(0, 5);
  const remaining = Math.max(todayItems.length - visibleTodayItems.length, 0);
  const priorityDot = {
    routine: "text-muted-foreground/50",
    important: "text-amber-500",
    urgent: "text-red-500",
  };

  return (
    <section className="space-y-5">
      <div className="space-y-5">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Operaciones internas
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Hola, {adminName}.
          </h2>
          {todayItems.length ? (
            <div className="mt-3">
              <p className="text-muted-foreground text-sm">
                Recuerda que hoy tienes:
              </p>
              <ul className="mt-2 max-w-2xl space-y-1">
                {visibleTodayItems.map((item) => (
                  <li key={`${item.id}:${item.occurrenceDate}`}>
                    <Link
                      href={`/dashboard/calendar?item=${item.id}&date=${item.occurrenceDate}`}
                      className="group hover:bg-muted focus-visible:ring-ring/50 -ml-2 flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]"
                    >
                      <Circle
                        className={`size-2.5 fill-current ${priorityDot[item.priority]}`}
                        aria-hidden
                      />
                      <span>{getCalendarItemLabel(item)}</span>
                      {!item.allDay && item.startAt ? (
                        <time className="text-muted-foreground text-xs font-normal">
                          {new Intl.DateTimeFormat("es", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: item.timezone,
                          }).format(new Date(item.startAt))}
                        </time>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
              {remaining ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  y {remaining} actividades más.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              No tienes actividades programadas para hoy.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Calendario del equipo</h3>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/calendar">Ver calendario</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/calendar">
                <Plus className="size-4" />
                Agregar actividad
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr_1fr]">
        <TaskList title="Próximas 7 días" items={upcoming} />
        <SurfaceCard padding="sm">
          <h3 className="font-semibold capitalize">
            {new Intl.DateTimeFormat("es", {
              month: "long",
              year: "numeric",
            }).format(today)}
          </h3>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {["D", "L", "M", "M", "J", "V", "S"].map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="text-muted-foreground text-[10px]"
              >
                {label}
              </span>
            ))}
            {days.map((day) => {
              const date = day.toISOString().slice(0, 10);
              const count = items.filter(
                (item) => item.occurrenceDate === date,
              ).length;
              return (
                <Link
                  href={`/dashboard/calendar?date=${date}`}
                  key={date}
                  className={`hover:bg-muted focus-visible:ring-ring/50 relative flex aspect-square items-center justify-center rounded-md text-xs focus-visible:ring-2 focus-visible:outline-none ${day.getUTCMonth() !== month ? "text-muted-foreground/40" : ""}`}
                >
                  {day.getUTCDate()}
                  {count ? (
                    <span className="bg-primary absolute bottom-0.5 size-1 rounded-full" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </SurfaceCard>
        <TaskList title="Atrasadas" items={overdue} overdue />
      </div>
      {overdue.length ? (
        <p className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          Hay actividades vencidas que requieren atención.
        </p>
      ) : null}
    </section>
  );
}
