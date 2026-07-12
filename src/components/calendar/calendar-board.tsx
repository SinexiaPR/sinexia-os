"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  addCalendarComment,
  completeCalendarItem,
  deleteCalendarItem,
} from "@/actions/calendar";
import { CalendarForm } from "@/components/calendar/calendar-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import type {
  CalendarComment,
  CalendarItem,
  CalendarOption,
} from "@/types/calendar";

const labels = {
  type: {
    task: "Tarea",
    activity: "Actividad",
    reminder: "Recordatorio",
    internal_message: "Mensaje interno",
  },
  priority: { routine: "Rutina", important: "Importante", urgent: "Urgente" },
  status: {
    pending: "Pendiente",
    in_progress: "En proceso",
    completed: "Completada",
    cancelled: "Cancelada",
  },
};
const priorityClass = {
  routine: "border-border bg-muted/40",
  important: "border-amber-300 bg-amber-50 text-amber-950",
  urgent: "border-red-300 bg-red-50 text-red-950",
};
const monthFormatter = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateFormatter = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dateAt(value: string) {
  return new Date(`${value}T12:00:00Z`);
}
function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ItemCard({
  item,
  compact = false,
}: {
  item: CalendarItem;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/dashboard/calendar?item=${item.id}&date=${item.occurrenceDate}`}
      className={cn(
        "hover:border-primary/50 block rounded-lg border p-2 text-left transition",
        priorityClass[item.priority],
        item.status === "completed" && "opacity-55",
      )}
    >
      <p
        className={cn(
          "truncate font-medium",
          compact ? "text-xs" : "text-sm",
          item.status === "completed" && "line-through",
        )}
      >
        {item.title}
      </p>
      {!compact ? (
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs opacity-75">
          <span>{dateFormatter.format(dateAt(item.occurrenceDate))}</span>
          {item.companyName ? <span>{item.companyName}</span> : null}
          {item.assignedName ? <span>{item.assignedName}</span> : null}
        </div>
      ) : null}
    </Link>
  );
}

export function CalendarBoard({
  items,
  companies,
  admins,
  initialDate,
  selectedItem,
  comments = [],
}: {
  items: CalendarItem[];
  companies: CalendarOption[];
  admins: CalendarOption[];
  initialDate: string;
  selectedItem?: CalendarItem | null;
  comments?: CalendarComment[];
}) {
  const [month, setMonth] = useState(dateAt(initialDate));
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [formItem, setFormItem] = useState<CalendarItem | null | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [itemType, setItemType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const q = search.toLowerCase();
        return (
          (!q ||
            `${item.title} ${item.description ?? ""} ${item.companyName ?? ""}`
              .toLowerCase()
              .includes(q)) &&
          (!company || item.companyId === company) &&
          (!assignee || item.assignedTo === assignee) &&
          (!status || item.status === status) &&
          (!priority || item.priority === priority) &&
          (!itemType || item.itemType === itemType) &&
          (!fromDate || item.occurrenceDate >= fromDate) &&
          (!toDate || item.occurrenceDate <= toDate)
        );
      }),
    [
      items,
      search,
      company,
      assignee,
      status,
      priority,
      itemType,
      fromDate,
      toDate,
    ],
  );

  const monthStart = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12),
  );
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(1 - monthStart.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const weekStart = new Date(dateAt(initialDate));
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const selectClass =
    "h-9 rounded-md border border-input bg-background px-2 text-sm";
  const changeMonth = (delta: number) =>
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1, 12),
      ),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Mes anterior</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setMonth(dateAt(initialDate))}
          >
            Hoy
          </Button>
          <Button size="icon" variant="outline" onClick={() => changeMonth(1)}>
            <ChevronRight className="size-4" />
            <span className="sr-only">Mes siguiente</span>
          </Button>
          <h2 className="ml-2 text-lg font-semibold capitalize">
            {monthFormatter.format(month)}
          </h2>
        </div>
        <Button onClick={() => setFormItem(null)}>
          <Plus className="size-4" />
          Agregar actividad
        </Button>
      </div>

      <SurfaceCard padding="sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(5,auto)]">
          <label className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, nota o empresa"
              className="pl-9"
            />
          </label>
          <select
            aria-label="Empresa"
            className={selectClass}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="">Empresas</option>
            {companies.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Asignado"
            className={selectClass}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Equipo</option>
            {admins.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado"
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Estados</option>
            {Object.entries(labels.status).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Prioridad"
            className={selectClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">Prioridades</option>
            {Object.entries(labels.priority).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo"
            className={selectClass}
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
          >
            <option value="">Tipos</option>
            {Object.entries(labels.type).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <label className="text-muted-foreground text-xs">
            Desde
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="text-muted-foreground text-xs">
            Hasta
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
        </div>
      </SurfaceCard>

      <div className="bg-muted flex gap-1 rounded-lg p-1 md:w-fit">
        <Button
          size="sm"
          variant={view === "month" ? "default" : "ghost"}
          onClick={() => setView("month")}
          className="hidden md:inline-flex"
        >
          Mes
        </Button>
        <Button
          size="sm"
          variant={view === "week" ? "default" : "ghost"}
          onClick={() => setView("week")}
        >
          Semana
        </Button>
        <Button
          size="sm"
          variant={view === "agenda" ? "default" : "ghost"}
          onClick={() => setView("agenda")}
        >
          Agenda
        </Button>
      </div>

      {view === "month" ? (
        <div className="bg-card hidden overflow-hidden rounded-2xl border md:block">
          <div className="bg-muted/40 grid grid-cols-7 border-b">
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
              <div
                key={d}
                className="text-muted-foreground p-2 text-center text-xs font-medium"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayIso = iso(day);
              const dayItems = filtered.filter(
                (i) => i.occurrenceDate === dayIso,
              );
              return (
                <div
                  key={dayIso}
                  className={cn(
                    "min-h-28 border-r border-b p-1.5",
                    day.getUTCMonth() !== month.getUTCMonth() &&
                      "bg-muted/20 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-full text-xs",
                      dayIso === initialDate &&
                        "bg-primary text-primary-foreground",
                    )}
                  >
                    {day.getUTCDate()}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayItems.slice(0, 3).map((i) => (
                      <ItemCard
                        key={`${i.id}:${i.occurrenceDate}`}
                        item={i}
                        compact
                      />
                    ))}
                    {dayItems.length > 3 ? (
                      <p className="text-muted-foreground px-1 text-xs">
                        +{dayItems.length - 3} más
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === "week" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((day) => {
            const date = iso(day);
            return (
              <SurfaceCard key={date} padding="sm">
                <h3
                  className={cn(
                    "mb-3 text-sm font-semibold capitalize",
                    date === initialDate && "text-primary",
                  )}
                >
                  {dateFormatter.format(day)}
                </h3>
                <div className="space-y-2">
                  {filtered
                    .filter((i) => i.occurrenceDate === date)
                    .map((i) => (
                      <ItemCard key={`${i.id}:${date}`} item={i} />
                    ))}
                  {!filtered.some((i) => i.occurrenceDate === date) ? (
                    <p className="text-muted-foreground text-xs">
                      Sin actividades
                    </p>
                  ) : null}
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      ) : null}

      {view === "agenda" || view === "month" ? (
        <div className={cn("space-y-3", view === "month" ? "md:hidden" : "")}>
          {filtered.length ? (
            filtered.map((item) => (
              <ItemCard key={`${item.id}:${item.occurrenceDate}`} item={item} />
            ))
          ) : (
            <SurfaceCard>
              <p className="text-muted-foreground text-sm">
                No hay actividades para estos filtros.
              </p>
            </SurfaceCard>
          )}
        </div>
      ) : null}

      {selectedItem ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/25">
          <aside className="bg-background h-full w-full max-w-lg overflow-y-auto border-l p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {labels.type[selectedItem.itemType]}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedItem.title}
                </h2>
              </div>
              <Button asChild size="icon" variant="ghost">
                <Link href="/dashboard/calendar">
                  <X className="size-4" />
                  <span className="sr-only">Cerrar</span>
                </Link>
              </Button>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <p className="flex gap-2">
                <CalendarDays className="size-4" />
                {dateFormatter.format(dateAt(selectedItem.occurrenceDate))}
              </p>
              {!selectedItem.allDay ? (
                <p className="flex gap-2">
                  <Clock className="size-4" />
                  {selectedItem.startAt
                    ? new Date(selectedItem.startAt).toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: selectedItem.timezone,
                      })
                    : ""}{" "}
                  · {selectedItem.timezone}
                </p>
              ) : (
                <p>Todo el día</p>
              )}
              <p>
                Prioridad: {labels.priority[selectedItem.priority]} · Estado:{" "}
                {labels.status[selectedItem.status]}
              </p>
              {selectedItem.companyName ? (
                <p>Empresa: {selectedItem.companyName}</p>
              ) : null}
              <p>Asignada a: {selectedItem.assignedName ?? "Sin asignar"}</p>
              <p>
                Creada por {selectedItem.createdByName} · actualizada por{" "}
                {selectedItem.updatedByName}
              </p>
              {selectedItem.description ? (
                <p className="bg-muted rounded-lg p-3 whitespace-pre-wrap">
                  {selectedItem.description}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => setFormItem(selectedItem)}>Editar</Button>
              {selectedItem.status !== "completed" ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await completeCalendarItem(
                        selectedItem.id,
                        selectedItem.occurrenceDate,
                        Boolean(selectedItem.recurrenceRule),
                      );
                    })
                  }
                >
                  <Check className="size-4" />
                  Marcar completada
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      selectedItem.recurrenceRule
                        ? "¿Eliminar toda la serie?"
                        : "¿Eliminar esta actividad?",
                    )
                  )
                    startTransition(async () => {
                      await deleteCalendarItem(
                        selectedItem.id,
                        selectedItem.occurrenceDate,
                        "series",
                      );
                    });
                }}
              >
                Eliminar
              </Button>
            </div>
            <div className="mt-8 border-t pt-6">
              <h3 className="font-semibold">Actividad interna</h3>
              <div className="mt-4 space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="text-muted-foreground flex justify-between gap-3 text-xs">
                      <span>{c.authorName}</span>
                      <time>{new Date(c.createdAt).toLocaleString("es")}</time>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const content =
                    new FormData(form).get("content")?.toString() ?? "";
                  startTransition(async () => {
                    const result = await addCalendarComment(
                      selectedItem.id,
                      content,
                    );
                    if (result.success) form.reset();
                  });
                }}
              >
                <textarea
                  name="content"
                  required
                  maxLength={1000}
                  rows={3}
                  placeholder="Agregar comentario interno…"
                  className="w-full rounded-md border p-3 text-sm"
                />
                <div className="mt-2 flex justify-end">
                  <Button type="submit" size="sm" disabled={pending}>
                    Comentar
                  </Button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
      {formItem !== undefined ? (
        <CalendarForm
          item={formItem}
          companies={companies}
          admins={admins}
          onClose={() => setFormItem(undefined)}
        />
      ) : null}
    </div>
  );
}
