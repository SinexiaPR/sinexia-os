"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, FileText, Plus, Save } from "lucide-react";

import {
  approveWeeklyPayroll,
  createWeeklyPayroll,
  savePayrollEmployee,
  saveWeeklyPayrollEntries,
  setPayrollEmployeeActive,
  submitWeeklyPayroll,
  type PayrollEmployeeInput,
} from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { calculatePayrollEntry } from "@/lib/payroll/calculations";
import {
  type PayrollEmployee,
  type WeeklyPayroll,
  type WeeklyPayrollEntry,
} from "@/services/payroll";

type Company = { id: string; name: string; slug: string };
const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const money = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
});

export function PayrollWorkspace({
  company,
  isAdmin,
  employees,
  payrolls,
  selected,
  entries,
}: {
  company: Company;
  isAdmin: boolean;
  employees: PayrollEmployee[];
  payrolls: WeeklyPayroll[];
  selected: WeeklyPayroll | null;
  entries: WeeklyPayrollEntry[];
}) {
  const [tab, setTab] = useState<"weekly" | "employees">("weekly");
  const [entryState, setEntryState] = useState(entries);
  const [employeeForm, setEmployeeForm] = useState<
    PayrollEmployee | "new" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = useMemo(
    () =>
      entryState.reduce((sum, item) => sum + calculatePayrollEntry(item), 0),
    [entryState],
  );
  const updateEntry = (
    id: string,
    field: "regular_hours" | "training_hours" | "other_payments" | "comment",
    value: string,
  ) =>
    setEntryState((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "comment" ? value : Number(value || 0),
            }
          : item,
      ),
    );
  const run = (
    operation: () => Promise<{ error?: string; success?: boolean }>,
  ) =>
    startTransition(async () => {
      setMessage(null);
      const result = await operation();
      setMessage(result.error ?? "Guardado correctamente.");
      if (result.success) window.location.reload();
    });

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        {isAdmin ? (
          <Button asChild variant="ghost" className="-ml-3">
            <Link href={`/dashboard/admin/companies/${company.id}/payroll`}>
              <ArrowLeft className="size-4" />
              Volver a {company.name}
            </Link>
          </Button>
        ) : null}
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {company.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Nómina semanal
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Los empleados y tarifas se cargan automáticamente. Ingresa
            únicamente los datos variables de la semana.
          </p>
        </div>
      </header>
      <div className="bg-muted flex gap-1 rounded-lg p-1 sm:w-fit">
        <Button
          size="sm"
          variant={tab === "weekly" ? "default" : "ghost"}
          onClick={() => setTab("weekly")}
        >
          Nóminas semanales
        </Button>
        <Button
          size="sm"
          variant={tab === "employees" ? "default" : "ghost"}
          onClick={() => setTab("employees")}
        >
          Empleados y tarifas
        </Button>
      </div>
      {message ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${message.includes("correctamente") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          {message}
        </p>
      ) : null}

      {tab === "weekly" ? (
        <div className="space-y-6">
          {!selected || selected.status !== "draft" ? (
            <SurfaceCard>
              <h2 className="font-semibold">Crear nómina semanal</h2>
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value =
                    new FormData(event.currentTarget)
                      .get("weekStart")
                      ?.toString() ?? "";
                  run(() => createWeeklyPayroll(company.id, value));
                }}
              >
                <label className="text-sm">
                  Inicio de semana
                  <Input
                    name="weekStart"
                    type="date"
                    required
                    className="mt-1"
                  />
                </label>
                <Button type="submit" disabled={pending}>
                  Crear borrador
                </Button>
              </form>
            </SurfaceCard>
          ) : null}
          {selected ? (
            <>
              <SurfaceCard padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      Semana {selected.week_start} — {selected.week_end}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Estado:{" "}
                      {selected.status === "draft"
                        ? "Borrador"
                        : selected.status === "submitted"
                          ? "Enviada"
                          : "Aprobada"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xl font-semibold">
                      {money.format(total)}
                    </p>
                    {selected.status !== "draft" ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`/api/payroll/${selected.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText className="size-4" />
                          Ver e imprimir PDF
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </SurfaceCard>
              <div className="space-y-4">
                {entryState.map((entry) => (
                  <SurfaceCard key={entry.id} padding="sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">
                          {entry.employee_name_snapshot}
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          {entry.section_snapshot} ·{" "}
                          {entry.compensation_type_snapshot ??
                            "Compensación pendiente"}
                        </p>
                        {entry.requires_review_snapshot ? (
                          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertTriangle className="size-3" />
                            Requiere revisión de compensación
                          </p>
                        ) : null}
                      </div>
                      <p className="font-semibold">
                        {money.format(calculatePayrollEntry(entry))}
                      </p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <label className="text-muted-foreground text-xs">
                        Horas regulares
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.regular_hours}
                          disabled={selected.status !== "draft"}
                          onChange={(e) =>
                            updateEntry(
                              entry.id,
                              "regular_hours",
                              e.target.value,
                            )
                          }
                          className="mt-1"
                        />
                      </label>
                      <label className="text-muted-foreground text-xs">
                        Horas entrenamiento
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.training_hours}
                          disabled={selected.status !== "draft"}
                          onChange={(e) =>
                            updateEntry(
                              entry.id,
                              "training_hours",
                              e.target.value,
                            )
                          }
                          className="mt-1"
                        />
                      </label>
                      <label className="text-muted-foreground text-xs">
                        Otros pagos
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.other_payments}
                          disabled={selected.status !== "draft"}
                          onChange={(e) =>
                            updateEntry(
                              entry.id,
                              "other_payments",
                              e.target.value,
                            )
                          }
                          className="mt-1"
                        />
                      </label>
                      <label className="text-muted-foreground text-xs">
                        Comentario
                        <Input
                          value={entry.comment ?? ""}
                          maxLength={500}
                          disabled={selected.status !== "draft"}
                          onChange={(e) =>
                            updateEntry(entry.id, "comment", e.target.value)
                          }
                          className="mt-1"
                        />
                      </label>
                    </div>
                  </SurfaceCard>
                ))}
              </div>
              {selected.status === "draft" ? (
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        saveWeeklyPayrollEntries(
                          company.id,
                          selected.id,
                          entryState.map((item) => ({
                            id: item.id,
                            regularHours: Number(item.regular_hours),
                            trainingHours: Number(item.training_hours),
                            otherPayments: Number(item.other_payments),
                            comment: item.comment,
                          })),
                        ),
                      )
                    }
                  >
                    <Save className="size-4" />
                    Guardar borrador
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const saved = await saveWeeklyPayrollEntries(
                          company.id,
                          selected.id,
                          entryState.map((item) => ({
                            id: item.id,
                            regularHours: Number(item.regular_hours),
                            trainingHours: Number(item.training_hours),
                            otherPayments: Number(item.other_payments),
                            comment: item.comment,
                          })),
                        );
                        return saved.error
                          ? saved
                          : submitWeeklyPayroll(company.id, selected.id);
                      })
                    }
                  >
                    Enviar nómina
                  </Button>
                </div>
              ) : null}
              {isAdmin && selected.status === "submitted" ? (
                <div className="flex justify-end">
                  <Button
                    disabled={pending}
                    onClick={() =>
                      run(() => approveWeeklyPayroll(company.id, selected.id))
                    }
                  >
                    Aprobar nómina
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
          {payrolls.length > 1 ? (
            <SurfaceCard>
              <h2 className="font-semibold">Historial</h2>
              <div className="mt-3 space-y-2">
                {payrolls.map((payroll) => (
                  <p key={payroll.id} className="text-sm">
                    {payroll.week_start} — {payroll.week_end} · {payroll.status}
                  </p>
                ))}
              </div>
            </SurfaceCard>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Directorio de empleados</h2>
              <p className="text-muted-foreground text-sm">
                Los cambios aplican a borradores actuales y nóminas futuras; las
                enviadas no cambian.
              </p>
            </div>
            <Button onClick={() => setEmployeeForm("new")}>
              <Plus className="size-4" />
              Agregar empleado
            </Button>
          </div>
          {employees.map((employee) => (
            <SurfaceCard key={employee.id} padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium">
                    {employee.first_name} {employee.last_name}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {employee.section} ·{" "}
                    {employee.compensation_type ?? "Sin configurar"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Regular{" "}
                    {employee.regular_hourly_rate == null
                      ? "—"
                      : money.format(employee.regular_hourly_rate)}{" "}
                    · Entrenamiento{" "}
                    {employee.training_hourly_rate == null
                      ? "—"
                      : money.format(employee.training_hourly_rate)}{" "}
                    · Semanal{" "}
                    {employee.fixed_weekly_salary == null
                      ? "—"
                      : money.format(employee.fixed_weekly_salary)}
                  </p>
                  {employee.requires_compensation_review ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      Requiere revisión
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEmployeeForm(employee)}
                  >
                    Editar tarifas
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setPayrollEmployeeActive(
                          company.id,
                          employee.id,
                          !employee.active,
                        ),
                      )
                    }
                  >
                    {employee.active ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
      {employeeForm ? (
        <EmployeeDialog
          companyId={company.id}
          employee={employeeForm === "new" ? null : employeeForm}
          pending={pending}
          onClose={() => setEmployeeForm(null)}
          onSave={(input) => run(() => savePayrollEmployee(input))}
        />
      ) : null}
    </div>
  );
}

function EmployeeDialog({
  companyId,
  employee,
  pending,
  onClose,
  onSave,
}: {
  companyId: string;
  employee: PayrollEmployee | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: PayrollEmployeeInput) => void;
}) {
  const [type, setType] = useState<
    "hourly" | "hourly_training" | "fixed_weekly"
  >(employee?.compensation_type ?? "hourly");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-6">
      <SurfaceCard className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none sm:rounded-b-2xl">
        <h2 className="text-lg font-semibold">
          {employee ? "Editar empleado y tarifas" : "Agregar empleado"}
        </h2>
        {employee ? (
          <p className="mt-2 text-sm text-amber-800">
            Este cambio aplicará a nóminas futuras y borradores actuales. Las
            nóminas enviadas no serán modificadas.
          </p>
        ) : null}
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const number = (name: string) =>
              data.get(name) ? Number(data.get(name)) : null;
            onSave({
              id: employee?.id,
              companyId,
              firstName: String(data.get("firstName")),
              lastName: String(data.get("lastName")),
              section: String(
                data.get("section"),
              ) as PayrollEmployeeInput["section"],
              compensationType: type,
              regularRate: number("regularRate"),
              trainingRate: number("trainingRate"),
              fixedSalary: number("fixedSalary"),
              internalNote: String(data.get("internalNote") || "") || null,
            });
          }}
        >
          <label className="text-sm">
            Nombre
            <Input
              name="firstName"
              required
              defaultValue={employee?.first_name}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Apellido
            <Input
              name="lastName"
              required
              defaultValue={employee?.last_name}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Sección
            <select
              name="section"
              required
              defaultValue={employee?.section ?? "BOTANICO FOH"}
              className={`${inputClass} mt-1`}
            >
              <option>BOTANICO FOH</option>
              <option>SELVA FOH</option>
              <option>BOH</option>
            </select>
          </label>
          <label className="text-sm">
            Compensación
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className={`${inputClass} mt-1`}
            >
              <option value="hourly">Por hora</option>
              <option value="hourly_training">
                Por hora con entrenamiento
              </option>
              <option value="fixed_weekly">Salario semanal fijo</option>
            </select>
          </label>
          {type !== "fixed_weekly" ? (
            <label className="text-sm">
              Tarifa regular
              <Input
                name="regularRate"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={employee?.regular_hourly_rate ?? ""}
                className="mt-1"
              />
            </label>
          ) : null}
          {type === "hourly_training" ? (
            <label className="text-sm">
              Tarifa entrenamiento
              <Input
                name="trainingRate"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={employee?.training_hourly_rate ?? ""}
                className="mt-1"
              />
            </label>
          ) : null}
          {type === "fixed_weekly" ? (
            <label className="text-sm">
              Salario semanal
              <Input
                name="fixedSalary"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={employee?.fixed_weekly_salary ?? ""}
                className="mt-1"
              />
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">
            Nota interna
            <textarea
              name="internalNote"
              maxLength={1000}
              defaultValue={employee?.internal_note ?? ""}
              className="mt-1 w-full rounded-md border p-3"
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
}
