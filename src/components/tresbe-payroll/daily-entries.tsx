"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  createTresbeDailyEntry,
  deleteTresbeDailyEntry,
  saveTresbeDailyEntryHours,
  saveTresbeShiftPoolAmount,
} from "@/actions/tresbe-payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  TresbeEmployee,
  TresbePayroll,
  TresbePayrollDailyEntry,
  TresbePayrollShiftPool,
  TresbeShift,
} from "@/services/tresbe-payroll";

type Company = { id: string; name: string; slug: string };

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const dayLabel = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const shifts: TresbeShift[] = ["AM", "PM"];

function weekDates(weekStart: string) {
  const dates: string[] = [];
  const base = new Date(`${weekStart}T12:00:00Z`);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

type Group = { pool: TresbePayrollShiftPool | null; entries: TresbePayrollDailyEntry[] };
type GroupsByDateShift = Record<string, Record<TresbeShift, Group>>;

function buildGroups(
  weekStart: string,
  pools: TresbePayrollShiftPool[],
  entries: TresbePayrollDailyEntry[],
): GroupsByDateShift {
  const groups: GroupsByDateShift = {};
  for (const date of weekDates(weekStart)) {
    groups[date] = {
      AM: { pool: null, entries: [] },
      PM: { pool: null, entries: [] },
    };
  }
  for (const pool of pools) {
    if (!groups[pool.work_date]) groups[pool.work_date] = { AM: { pool: null, entries: [] }, PM: { pool: null, entries: [] } };
    groups[pool.work_date][pool.shift].pool = pool;
  }
  for (const entry of entries) {
    if (!groups[entry.work_date]) groups[entry.work_date] = { AM: { pool: null, entries: [] }, PM: { pool: null, entries: [] } };
    groups[entry.work_date][entry.shift].entries.push(entry);
  }
  return groups;
}

export function TresbeDailyEntriesTab({
  company,
  payroll,
  employees,
  dailyEntries,
  shiftPools,
  editable,
}: {
  company: Company;
  payroll: TresbePayroll;
  employees: TresbeEmployee[];
  dailyEntries: TresbePayrollDailyEntry[];
  shiftPools: TresbePayrollShiftPool[];
  editable: boolean;
}) {
  const [groups, setGroups] = useState(() =>
    buildGroups(payroll.week_start, shiftPools, dailyEntries),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addForm, setAddForm] = useState<{
    workDate: string;
    shift: TresbeShift;
  } | null>(null);

  const employeesById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );
  const activeEmployees = useMemo(
    () =>
      [...employees]
        .filter((e) => e.is_active)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [employees],
  );

  const applyGroup = (workDate: string, shift: TresbeShift, group: Group) => {
    setGroups((current) => ({
      ...current,
      [workDate]: { ...current[workDate], [shift]: group },
    }));
  };

  const run = (
    workDate: string,
    shift: TresbeShift,
    operation: () => Promise<
      | { error: string }
      | { success: true; pool: TresbePayrollShiftPool | null; entries: TresbePayrollDailyEntry[] }
    >,
  ) => {
    startTransition(async () => {
      setMessage(null);
      const result = await operation();
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      applyGroup(workDate, shift, { pool: result.pool, entries: result.entries });
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Carga Diaria</h2>
          <p className="text-muted-foreground text-sm">
            Horas y propina por día y turno. El pote de propina de cada
            turno se reparte proporcional a las horas entre quienes lo
            comparten -- lo calcula la base de datos, no esta pantalla.
          </p>
        </div>
        {!editable ? (
          <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            Solo lectura -- esta nómina ya no está en borrador.
          </p>
        ) : null}
      </div>
      {message ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </p>
      ) : null}

      {weekDates(payroll.week_start).map((date) => (
        <SurfaceCard key={date}>
          <h3 className="font-semibold capitalize">{dayLabel.format(new Date(`${date}T12:00:00Z`))}</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {shifts.map((shift) => {
              const group = groups[date]?.[shift] ?? { pool: null, entries: [] };
              const poolAmount = group.pool?.tip_pool_amount ?? 0;
              const isAdding =
                addForm?.workDate === date && addForm.shift === shift;
              return (
                <div key={shift} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">Turno {shift}</h4>
                    <label className="flex items-center gap-2 text-xs">
                      Pote propina
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={poolAmount}
                        disabled={!editable || pending}
                        className="h-7 w-24 text-xs"
                        onBlur={(event) => {
                          const value = Number(event.target.value || 0);
                          if (value === poolAmount) return;
                          run(date, shift, () =>
                            saveTresbeShiftPoolAmount({
                              companyId: company.id,
                              payrollId: payroll.id,
                              workDate: date,
                              shift,
                              tipPoolAmount: value,
                            }),
                          );
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b">
                          <th className="py-1.5 pr-2 font-medium">Empleado</th>
                          <th className="py-1.5 pr-2 font-medium">Área</th>
                          <th className="py-1.5 pr-2 text-right font-medium">
                            Horas
                          </th>
                          <th className="py-1.5 pr-2 text-right font-medium">
                            Propina
                          </th>
                          <th className="py-1.5 pr-2 font-medium">Notas</th>
                          <th className="py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry) => {
                          const employee = employeesById.get(entry.employee_id);
                          return (
                            <tr key={entry.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-2">
                                {employee?.display_name ?? "(empleado eliminado)"}
                              </td>
                              <td className="text-muted-foreground py-1.5 pr-2">
                                {entry.area_snapshot}
                              </td>
                              <td className="py-1.5 pr-2 text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={entry.hours}
                                  disabled={!editable || pending}
                                  className="h-7 w-16 text-right text-xs"
                                  onBlur={(event) => {
                                    const value = Number(event.target.value || 0);
                                    if (value === Number(entry.hours)) return;
                                    run(date, shift, () =>
                                      saveTresbeDailyEntryHours({
                                        companyId: company.id,
                                        payrollId: payroll.id,
                                        entryId: entry.id,
                                        hours: value,
                                        tipCafeManual: Number(entry.tip_cafe_manual),
                                        notes: entry.notes,
                                      }),
                                    );
                                  }}
                                />
                              </td>
                              <td className="py-1.5 pr-2 text-right">
                                {entry.receives_proportional_tips_snapshot ? (
                                  <span title="Propina proporcional del pote -- se calcula sola.">
                                    {money.format(entry.tip_proportional)}
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={entry.tip_cafe_manual}
                                    disabled={!editable || pending}
                                    className="h-7 w-20 text-right text-xs"
                                    onBlur={(event) => {
                                      const value = Number(
                                        event.target.value || 0,
                                      );
                                      if (value === Number(entry.tip_cafe_manual))
                                        return;
                                      run(date, shift, () =>
                                        saveTresbeDailyEntryHours({
                                          companyId: company.id,
                                          payrollId: payroll.id,
                                          entryId: entry.id,
                                          hours: Number(entry.hours),
                                          tipCafeManual: value,
                                          notes: entry.notes,
                                        }),
                                      );
                                    }}
                                  />
                                )}
                              </td>
                              <td className="py-1.5 pr-2">
                                <Input
                                  defaultValue={entry.notes ?? ""}
                                  disabled={!editable || pending}
                                  className="h-7 w-full text-xs"
                                  onBlur={(event) => {
                                    const value = event.target.value.trim();
                                    if (value === (entry.notes ?? "")) return;
                                    run(date, shift, () =>
                                      saveTresbeDailyEntryHours({
                                        companyId: company.id,
                                        payrollId: payroll.id,
                                        entryId: entry.id,
                                        hours: Number(entry.hours),
                                        tipCafeManual: Number(entry.tip_cafe_manual),
                                        notes: value || null,
                                      }),
                                    );
                                  }}
                                />
                              </td>
                              <td className="py-1.5">
                                {editable ? (
                                  <button
                                    type="button"
                                    aria-label="Eliminar fila"
                                    disabled={pending}
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `¿Eliminar la fila de ${employee?.display_name ?? "este empleado"}?`,
                                        )
                                      )
                                        return;
                                      run(date, shift, () =>
                                        deleteTresbeDailyEntry({
                                          companyId: company.id,
                                          payrollId: payroll.id,
                                          entryId: entry.id,
                                        }),
                                      );
                                    }}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                        {!group.entries.length ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="text-muted-foreground py-2 text-center"
                            >
                              Sin filas cargadas.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  {editable ? (
                    isAdding ? (
                      <form
                        className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          const employeeId = String(form.get("employeeId") ?? "");
                          if (!employeeId) return;
                          run(date, shift, () =>
                            createTresbeDailyEntry({
                              companyId: company.id,
                              payrollId: payroll.id,
                              employeeId,
                              workDate: date,
                              shift,
                              hours: Number(form.get("hours") || 0),
                              tipCafeManual: Number(form.get("tip") || 0),
                            }),
                          );
                          setAddForm(null);
                        }}
                      >
                        <label className="text-xs">
                          Empleado
                          <select
                            name="employeeId"
                            required
                            className="border-input bg-background mt-1 h-8 rounded-md border px-2 text-xs"
                          >
                            <option value="">Elegir...</option>
                            {activeEmployees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.display_name} ({employee.area})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs">
                          Horas
                          <Input
                            name="hours"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={0}
                            className="mt-1 h-8 w-20 text-xs"
                          />
                        </label>
                        <label className="text-xs">
                          Propina individual
                          <Input
                            name="tip"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={0}
                            className="mt-1 h-8 w-24 text-xs"
                          />
                        </label>
                        <Button size="sm" type="submit" disabled={pending}>
                          Agregar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          onClick={() => setAddForm(null)}
                        >
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => setAddForm({ workDate: date, shift })}
                      >
                        <Plus className="size-3.5" /> Agregar fila
                      </Button>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}
