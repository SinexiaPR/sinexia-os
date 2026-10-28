"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import {
  addCalendarComment,
  completeCalendarItem,
  completeCalendarItems,
  deleteCalendarItem,
} from "@/actions/calendar";
import { CalendarForm } from "@/components/calendar/calendar-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  AGENDA_DAYS,
  RECURRENCE_LABELS,
  buildAgenda,
} from "@/lib/calendar/agenda";
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
function itemKey(item: CalendarItem) {
  return `${item.id}:${item.occurrenceDate}`;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [optimisticItems, markCompleted] = useOptimistic(
    items,
    (state: CalendarItem[], keys: Set<string>) =>
      state.map((item) =>
        keys.has(itemKey(item))
          ? { ...item, status: "completed" as const }
          : item,
      ),
  );
  const filtered = useMemo(
    () =>
      optimisticItems.filter((item) => {
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
      optimisticItems,
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
  const activeFilterCount = [
    company,
    assignee,
    status,
    priority,
    itemType,
    fromDate,
    toDate,
  ].filter(Boolean).length;
  function clearFilters() {
    setCompany("");
    setAssignee("");
    setStatus("");
    setPriority("");
    setItemType("");
    setFromDate("");
    setToDate("");
  }
  // La agenda cubre los próximos 30 días y agrupa las series repetidas.
  const agenda = useMemo(
    () => buildAgenda(filtered, initialDate),
    [filtered, initialDate],
  );
  const selectableTasks = useMemo(
    () =>
      agenda
        .filter((entry) => entry.kind === "single")
        .map((entry) => entry.item)
        .filter(
          (item) => item.itemType === "task" && item.status !== "completed",
        ),
    [agenda],
  );
  const taskIndex = useMemo(
    () => new Map(selectableTasks.map((item, i) => [itemKey(item), i])),
    [selectableTasks],
  );
  const activeSelected = useMemo(
    () => selectableTasks.filter((item) => selected.has(itemKey(item))),
    [selectableTasks, selected],
  );
  const allTasksSelected =
    selectableTasks.length > 0 &&
    activeSelected.length === selectableTasks.length;

  function toggleSelection(item: CalendarItem, shiftKey: boolean) {
    const index = taskIndex.get(itemKey(item));
    if (index === undefined) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastIndex !== null) {
        const [start, end] =
          lastIndex < index ? [lastIndex, index] : [index, lastIndex];
        for (let i = start; i <= end; i++) {
          const row = selectableTasks[i];
          if (row) next.add(itemKey(row));
        }
      } else if (next.has(itemKey(item))) {
        next.delete(itemKey(item));
      } else {
        next.add(itemKey(item));
      }
      return next;
    });
    setLastIndex(index);
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allTasksSelected) {
        for (const item of selectableTasks) next.delete(itemKey(item));
      } else {
        for (const item of selectableTasks) next.add(itemKey(item));
      }
      return next;
    });
    setLastIndex(null);
  }

  function handleBulkComplete() {
    if (!activeSelected.length) return;
    setBulkError(null);
    const keys = new Set(activeSelected.map(itemKey));
    const payload = activeSelected.map((item) => ({
      id: item.id,
      occurrenceDate: item.occurrenceDate,
      recurring: Boolean(item.recurrenceRule),
    }));
    startTransition(async () => {
      markCompleted(keys);
      const result = await completeCalendarItems(payload);
      if (result.error) {
        setBulkError(result.error);
      } else {
        setSelected(new Set());
      }
    });
  }

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
    "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
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
          <h2 className="ml-2 text-lg font-semibold first-letter:uppercase">
            {monthFormatter.format(month)}
          </h2>
        </div>
        <Button onClick={() => setFormItem(null)}>
          <Plus className="size-4" />
          Agregar actividad
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-52 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="text-muted-foreground absolute top-3 left-3 size-4"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, nota o empresa"
            aria-label="Buscar en el calendario"
            className="h-10 pl-9"
          />
        </label>
        <FilterPanel
          title="Filtros"
          align="start"
          trigger={
            <Button variant="outline" className="h-10">
              <SlidersHorizontal className="size-4" />
              Filtros
              {activeFilterCount > 0 ? (
                <span className="bg-primary text-primary-foreground ml-1 flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          }
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Empresa</label>
            <Combobox
              aria-label="Empresa"
              options={companies.map((o) => ({ value: o.id, label: o.name }))}
              value={company}
              onValueChange={setCompany}
              allLabel="Todas las empresas"
              placeholder="Todas las empresas"
              searchPlaceholder="Buscar empresa…"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cal-equipo" className="text-sm font-medium">
              Equipo
            </label>
            <select
              id="cal-equipo"
              className={selectClass}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Todo el equipo</option>
              {admins.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label htmlFor="cal-estado" className="text-sm font-medium">
                Estado
              </label>
              <select
                id="cal-estado"
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(labels.status).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cal-prioridad" className="text-sm font-medium">
                Prioridad
              </label>
              <select
                id="cal-prioridad"
                className={selectClass}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">Todas</option>
                {Object.entries(labels.priority).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cal-tipo" className="text-sm font-medium">
              Tipo
            </label>
            <select
              id="cal-tipo"
              className={selectClass}
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {Object.entries(labels.type)
                .filter(([v]) => v !== "task")
                .map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label htmlFor="cal-desde" className="text-sm font-medium">
                Desde
              </label>
              <Input
                id="cal-desde"
                type="date"
                className="h-10"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cal-hasta" className="text-sm font-medium">
                Hasta
              </label>
              <Input
                id="cal-hasta"
                type="date"
                className="h-10"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </FilterPanel>
      </div>

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
        <div className="bg-card hidden overflow-hidden rounded-lg border md:block">
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

      {view === "month" ? (
        <div className="space-y-3 md:hidden">
          <p className="text-muted-foreground text-sm">
            Próximos {AGENDA_DAYS} días
          </p>
          {agenda.length ? (
            agenda.map((entry) => (
              <ItemCard
                key={
                  entry.kind === "series"
                    ? `serie-${entry.item.id}`
                    : itemKey(entry.item)
                }
                item={entry.item}
              />
            ))
          ) : (
            <SurfaceCard padding="sm" className="p-0">
              <EmptyState
                icon={CalendarDays}
                title="No hay actividades en los próximos 30 días"
                description={
                  activeFilterCount > 0 || search
                    ? "Prueba quitando los filtros."
                    : undefined
                }
              />
            </SurfaceCard>
          )}
        </div>
      ) : null}

      {view === "agenda" ? (
        <div className="space-y-3">
          {selectableTasks.length ? (
            <SurfaceCard padding="sm">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={
                    allTasksSelected
                      ? true
                      : activeSelected.length > 0
                        ? "indeterminate"
                        : false
                  }
                  onClick={toggleSelectAll}
                />
                Seleccionar todas las tareas visibles ({selectableTasks.length})
              </label>
            </SurfaceCard>
          ) : null}
          <p className="text-muted-foreground text-sm">
            Próximos {AGENDA_DAYS} días
          </p>
          {agenda.length ? (
            agenda.map((entry) => {
              const { item } = entry;
              if (entry.kind === "series") {
                return (
                  <div key={`serie-${item.id}`} className="space-y-1">
                    <ItemCard item={item} />
                    <p className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
                      <Repeat aria-hidden className="size-3.5" />
                      {item.recurrenceRule
                        ? RECURRENCE_LABELS[item.recurrenceRule.frequency]
                        : "Se repite"}
                      {" · "}
                      {entry.count} {entry.count === 1 ? "vez" : "veces"} en los
                      próximos {AGENDA_DAYS} días
                    </p>
                  </div>
                );
              }
              return item.itemType === "task" && item.status !== "completed" ? (
                <div key={itemKey(item)} className="flex items-start gap-3">
                  <Checkbox
                    className="mt-3"
                    aria-label={`Seleccionar ${item.title}`}
                    checked={selected.has(itemKey(item))}
                    onClick={(event) => toggleSelection(item, event.shiftKey)}
                  />
                  <div className="flex-1">
                    <ItemCard item={item} />
                  </div>
                </div>
              ) : (
                <ItemCard key={itemKey(item)} item={item} />
              );
            })
          ) : (
            <SurfaceCard padding="sm" className="p-0">
              <EmptyState
                icon={CalendarDays}
                title="No hay actividades en los próximos 30 días"
                description={
                  activeFilterCount > 0 || search
                    ? "Prueba quitando los filtros."
                    : "Agrega una actividad con el botón de arriba."
                }
              />
            </SurfaceCard>
          )}
        </div>
      ) : null}

      {activeSelected.length > 0 ? (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center">
          <div className="bg-background flex flex-wrap items-center gap-3 rounded-full border px-4 py-2 shadow-lg">
            <span className="text-sm font-medium">
              {activeSelected.length} seleccionada
              {activeSelected.length === 1 ? "" : "s"}
            </span>
            {bulkError ? (
              <span className="text-destructive text-xs">{bulkError}</span>
            ) : null}
            <Button size="sm" disabled={pending} onClick={handleBulkComplete}>
              <Check className="size-4" />
              Marcar como completadas ({activeSelected.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelected(new Set());
                setBulkError(null);
              }}
            >
              Cancelar selección
            </Button>
          </div>
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
