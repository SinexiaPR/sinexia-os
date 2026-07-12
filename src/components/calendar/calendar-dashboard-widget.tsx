import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
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
              className="hover:border-primary/50 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition"
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
  dueToday,
  upcoming,
  overdue,
}: {
  items: CalendarItem[];
  dueToday: CalendarItem[];
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
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Operaciones internas
          </p>
          <h2 className="mt-1 text-xl font-semibold">Calendario del equipo</h2>
        </div>
        <div className="flex gap-2">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Para hoy"
          value={dueToday.length}
          hint="Pendientes o en proceso"
        />
        <MetricCard
          label="Atrasadas"
          value={overdue.length}
          hint="Máximo 5 en el resumen"
          className={overdue.length ? "border-red-200" : ""}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.1fr]">
        <TaskList title="Próximas 7 días" items={upcoming} />
        <TaskList title="Atrasadas" items={overdue} overdue />
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
                  className={`hover:bg-muted relative flex aspect-square items-center justify-center rounded-md text-xs ${day.getUTCMonth() !== month ? "text-muted-foreground/40" : ""}`}
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
      </div>
      {overdue.length ? (
        <p className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          Hay actividades vencidas que requieren atención.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" />
          No hay actividades vencidas.
        </p>
      )}
    </section>
  );
}
