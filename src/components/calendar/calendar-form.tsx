"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";

import { saveCalendarItem, type CalendarActionState } from "@/actions/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarItem, CalendarOption } from "@/types/calendar";

const initialState: CalendarActionState = {};
const field =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function CalendarForm({
  item,
  companies,
  admins,
  onClose,
}: {
  item?: CalendarItem | null;
  companies: CalendarOption[];
  admins: CalendarOption[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(
    saveCalendarItem,
    initialState,
  );
  const [allDay, setAllDay] = useState(item?.allDay ?? true);
  const recurring = Boolean(item?.recurrenceRule);
  useEffect(() => {
    if (state.success) window.setTimeout(onClose, 600);
  }, [state.success, onClose]);
  const recurrence =
    item?.recurrenceRule?.frequency === "monthly" &&
    item.recurrenceRule.monthlyMode === "last_business_day"
      ? "last_business_day"
      : (item?.recurrenceRule?.frequency ?? "none");
  const time = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: item?.timezone ?? "America/Puerto_Rico",
        })
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-background max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border p-5 shadow-xl sm:rounded-2xl sm:p-7">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {item ? "Editar actividad" : "Agregar actividad"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Zona horaria visible para actividades con hora.
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}>
            <X className="size-4" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </div>
        <form action={action} className="grid gap-5 sm:grid-cols-2">
          {item ? (
            <>
              <input type="hidden" name="id" value={item.id} />
              <input
                type="hidden"
                name="occurrenceDate"
                value={item.occurrenceDate}
              />
            </>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              name="title"
              required
              maxLength={160}
              defaultValue={item?.title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="itemType">Tipo *</Label>
            <select
              className={field}
              id="itemType"
              name="itemType"
              defaultValue={item?.itemType ?? "task"}
            >
              <option value="task">Tarea</option>
              <option value="activity">Actividad</option>
              <option value="reminder">Recordatorio</option>
              <option value="internal_message">Mensaje interno</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventDate">Fecha *</Label>
            <Input
              id="eventDate"
              name="eventDate"
              type="date"
              required
              defaultValue={
                item?.occurrenceDate ?? new Date().toISOString().slice(0, 10)
              }
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 sm:col-span-2">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            <span className="text-sm font-medium">Todo el día</span>
          </label>
          {!allDay ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora de inicio *</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  required
                  defaultValue={time(item?.startAt)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora de finalización *</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  required
                  defaultValue={time(item?.endAt)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="timezone">Zona horaria</Label>
                <select
                  className={field}
                  id="timezone"
                  name="timezone"
                  defaultValue={item?.timezone ?? "America/Puerto_Rico"}
                >
                  <option value="America/Puerto_Rico">Puerto Rico (AST)</option>
                  <option value="America/Argentina/Cordoba">
                    Argentina (ART)
                  </option>
                </select>
              </div>
            </>
          ) : (
            <input
              type="hidden"
              name="timezone"
              value={item?.timezone ?? "America/Puerto_Rico"}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="companyId">Empresa</Label>
            <select
              className={field}
              id="companyId"
              name="companyId"
              defaultValue={item?.companyId ?? ""}
            >
              <option value="">Sin empresa</option>
              {companies.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Asignar a</Label>
            <select
              className={field}
              id="assignedTo"
              name="assignedTo"
              defaultValue={item?.assignedTo ?? ""}
            >
              <option value="">Sin asignar</option>
              {admins.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad</Label>
            <select
              className={field}
              id="priority"
              name="priority"
              defaultValue={item?.priority ?? "routine"}
            >
              <option value="routine">Rutina</option>
              <option value="important">Importante</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <select
              className={field}
              id="status"
              name="status"
              defaultValue={item?.status ?? "pending"}
            >
              <option value="pending">Pendiente</option>
              <option value="in_progress">En proceso</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recurrence">Repetición</Label>
            <select
              className={field}
              id="recurrence"
              name="recurrence"
              defaultValue={recurrence}
            >
              <option value="none">No se repite</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Cada dos semanas</option>
              <option value="monthly">Mensual</option>
              <option value="weekdays">Días de semana personalizados</option>
              <option value="last_business_day">
                Último día hábil del mes
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recurrenceUntil">Repetir hasta</Label>
            <Input
              id="recurrenceUntil"
              name="recurrenceUntil"
              type="date"
              defaultValue={item?.recurrenceUntil ?? ""}
            />
          </div>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Días personalizados</legend>
            <div className="flex flex-wrap gap-3">
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(
                (label, day) => (
                  <label
                    key={label}
                    className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={day}
                      defaultChecked={item?.recurrenceRule?.weekdays?.includes(
                        day,
                      )}
                    />
                    {label}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          {item && recurring ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="editScope">Aplicar cambios a</Label>
              <select
                className={field}
                id="editScope"
                name="editScope"
                defaultValue="occurrence"
              >
                <option value="occurrence">Solo esta ocurrencia</option>
                <option value="future">Esta y futuras ocurrencias</option>
                <option value="series">Toda la serie</option>
              </select>
            </div>
          ) : (
            <input type="hidden" name="editScope" value="series" />
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descripción / nota interna</Label>
            <textarea
              id="description"
              name="description"
              maxLength={4000}
              rows={4}
              defaultValue={item?.description ?? ""}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          {state.error ? (
            <p className="text-destructive text-sm sm:col-span-2">
              {state.error}
            </p>
          ) : null}
          {state.message ? (
            <p className="text-sm text-emerald-700 sm:col-span-2">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
