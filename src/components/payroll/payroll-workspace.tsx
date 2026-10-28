"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronDown,
  FileText,
  History,
  Plus,
  RotateCcw,
  Save,
} from "lucide-react";

import {
  approveWeeklyPayroll,
  createWeeklyPayroll,
  reopenWeeklyPayroll,
  savePayrollEmployee,
  saveWeeklyPayrollEntries,
  setPayrollEmployeeActive,
  submitWeeklyPayroll,
  type PayrollEmployeeInput,
} from "@/actions/payroll";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { paginate } from "@/lib/pagination";
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
const statusLabel: Record<WeeklyPayroll["status"], string> = {
  draft: "Borrador",
  submitted: "Enviada",
  approved: "Aprobada",
};
const statusTone: Record<
  WeeklyPayroll["status"],
  "warning" | "info" | "success"
> = {
  draft: "warning",
  submitted: "info",
  approved: "success",
};
type PayrollTab = "weekly" | "employees" | "history" | "leave";

export function PayrollWorkspace({
  company,
  isAdmin,
  employees,
  payrolls,
  selected,
  entries,
  leaveSlot,
}: {
  company: Company;
  isAdmin: boolean;
  employees: PayrollEmployee[];
  payrolls: WeeklyPayroll[];
  selected: WeeklyPayroll | null;
  entries: WeeklyPayrollEntry[];
  /** Solo admin: contenido de la pestaña "Vacaciones y enfermedad". */
  leaveSlot?: ReactNode;
}) {
  const [tab, setTab] = useState<PayrollTab>("weekly");
  const [historyPage, setHistoryPage] = useState(1);
  const [entryState, setEntryState] = useState(entries);
  const [employeeForm, setEmployeeForm] = useState<
    PayrollEmployee | "new" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [pending, startTransition] = useTransition();
  const total = useMemo(
    () =>
      entryState.reduce((sum, item) => sum + calculatePayrollEntry(item), 0),
    [entryState],
  );
  const updateEntry = (
    id: string,
    field:
      | "regular_hours"
      | "training_hours"
      | "other_payments"
      | "vacation_paid_hours"
      | "sick_paid_hours"
      | "holiday_paid_hours"
      | "jury_duty_hours"
      | "bereavement_hours"
      | "comment",
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

  const payloadFromState = () =>
    entryState.map((item) => ({
      id: item.id,
      regularHours: Number(item.regular_hours),
      trainingHours: Number(item.training_hours),
      otherPayments: Number(item.other_payments),
      vacationPaidHours: Number(item.vacation_paid_hours),
      sickPaidHours: Number(item.sick_paid_hours),
      holidayPaidHours: Number(item.holiday_paid_hours),
      juryDutyHours: Number(item.jury_duty_hours),
      bereavementHours: Number(item.bereavement_hours),
      comment: item.comment,
    }));
  // La agrupación se calcula con los datos guardados, no con lo que se está
  // escribiendo, para que una fila no salte de lugar mientras se edita.
  const zeroIds = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => calculatePayrollEntry(entry) === 0)
          .map((entry) => entry.id),
      ),
    [entries],
  );
  const reviewEntries = entryState.filter(
    (entry) => entry.requires_review_snapshot,
  );
  const withHours = entryState.filter((entry) => !zeroIds.has(entry.id));
  const withoutHours = entryState.filter((entry) => zeroIds.has(entry.id));
  const history = paginate(payrolls, historyPage, 10);

  const renderEntry = (entry: WeeklyPayrollEntry) => {
    if (!selected) return null;
    const isFixed = entry.compensation_type_snapshot === "fixed_weekly";
    const isOpen = expanded.has(entry.id);
    return (
      <div key={entry.id} className="px-2 py-1">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-1 md:grid-cols-[1fr_90px_90px_100px_100px_40px] md:gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {entry.employee_name_snapshot}
            </p>
            {entry.requires_review_snapshot ? (
              <p className="text-warning flex items-center gap-1 text-[11px] font-medium">
                <AlertTriangle className="size-3" />
                Revisar tarifa
              </p>
            ) : null}
          </div>
          <div className="text-muted-foreground order-3 text-xs md:order-none md:text-right">
            <span className="md:hidden">Tarifa: </span>
            {isFixed
              ? `Fijo ${money.format(entry.fixed_salary_snapshot ?? 0)}`
              : entry.regular_rate_snapshot == null
                ? "—"
                : `${money.format(entry.regular_rate_snapshot)}/h`}
          </div>
          <div className="order-4 col-span-2 grid grid-cols-2 gap-2 md:contents">
            <label className="text-muted-foreground text-xs md:contents">
              <span className="md:sr-only">Horas</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                aria-label={`Horas de ${entry.employee_name_snapshot}`}
                value={entry.regular_hours}
                disabled={selected.status !== "draft" || isFixed}
                onChange={(e) =>
                  updateEntry(entry.id, "regular_hours", e.target.value)
                }
                className="mt-1 h-9 text-right text-sm md:mt-0 md:h-8"
              />
            </label>
            <label className="text-muted-foreground text-xs md:contents">
              <span className="md:sr-only">Tips</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                aria-label={`Tips de ${entry.employee_name_snapshot}`}
                value={entry.other_payments}
                disabled={selected.status !== "draft"}
                onChange={(e) =>
                  updateEntry(entry.id, "other_payments", e.target.value)
                }
                className="mt-1 h-9 text-right text-sm md:mt-0 md:h-8"
              />
            </label>
          </div>
          <p className="order-2 text-right text-sm font-semibold tabular-nums md:order-none">
            {money.format(calculatePayrollEntry(entry))}
          </p>
          <button
            type="button"
            onClick={() => toggleExpanded(entry.id)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Ocultar" : "Ver"} más campos de ${entry.employee_name_snapshot}`}
            className="text-muted-foreground hover:text-foreground hover:bg-muted order-5 col-span-2 flex h-10 items-center justify-center rounded-md md:order-none md:col-span-1 md:size-10"
          >
            <ChevronDown
              className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {isOpen ? (
          <div className="mt-1 grid gap-2 border-t pt-2 text-xs sm:grid-cols-5">
            <label className="text-muted-foreground">
              Horas entrenamiento
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entry.training_hours}
                disabled={selected.status !== "draft"}
                onChange={(e) =>
                  updateEntry(entry.id, "training_hours", e.target.value)
                }
                className="mt-1 h-7"
              />
            </label>
            <label className="text-muted-foreground">
              Vacaciones
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entry.vacation_paid_hours}
                disabled={selected.status !== "draft"}
                onChange={(e) =>
                  updateEntry(entry.id, "vacation_paid_hours", e.target.value)
                }
                className="mt-1 h-7"
              />
            </label>
            <label className="text-muted-foreground">
              Enfermedad
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entry.sick_paid_hours}
                disabled={selected.status !== "draft"}
                onChange={(e) =>
                  updateEntry(entry.id, "sick_paid_hours", e.target.value)
                }
                className="mt-1 h-7"
              />
            </label>
            <label className="text-muted-foreground">
              Feriado / Jurado / Duelo
              <Input
                type="number"
                min="0"
                step="0.01"
                value={entry.holiday_paid_hours}
                disabled={selected.status !== "draft"}
                onChange={(e) =>
                  updateEntry(entry.id, "holiday_paid_hours", e.target.value)
                }
                className="mt-1 h-7"
              />
            </label>
            <label className="text-muted-foreground">
              Comentario
              <Input
                value={entry.comment ?? ""}
                maxLength={500}
                disabled={selected.status !== "draft"}
                onChange={(e) =>
                  updateEntry(entry.id, "comment", e.target.value)
                }
                className="mt-1 h-7"
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Nómina semanal</h1>
        <p className="text-muted-foreground text-sm">
          Los empleados y tarifas se cargan automáticamente. Ingresa únicamente
          los datos variables de la semana.
        </p>
      </header>

      {message ? (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${message.includes("correctamente") ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        >
          {message}
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as PayrollTab)}>
        <TabsList>
          <TabsTrigger value="weekly">Semana actual</TabsTrigger>
          <TabsTrigger value="employees">Empleados y tarifas</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          {leaveSlot ? (
            <TabsTrigger value="leave">Vacaciones y enfermedad</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="weekly" className="space-y-5">
          {reviewEntries.length ? (
            <div
              role="alert"
              className="border-warning/30 bg-warning-soft text-warning flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3 text-sm"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p className="min-w-0 flex-1">
                <strong className="font-semibold">
                  {reviewEntries.length === 1
                    ? "1 empleado con tarifa por revisar:"
                    : `${reviewEntries.length} empleados con tarifa por revisar:`}
                </strong>{" "}
                {reviewEntries
                  .map((entry) => entry.employee_name_snapshot)
                  .join(", ")}
                .
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-background text-foreground h-9"
                onClick={() => setTab("employees")}
              >
                Revisar tarifas
              </Button>
            </div>
          ) : null}

          {selected ? (
            <SurfaceCard padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">
                      Semana {selected.week_start} — {selected.week_end}
                    </h2>
                    <StatusBadge tone={statusTone[selected.status]}>
                      {statusLabel[selected.status]}
                    </StatusBadge>
                  </div>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {money.format(total)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && selected.status === "submitted" ? (
                    <Button
                      className="h-10"
                      disabled={pending}
                      onClick={() =>
                        run(() => approveWeeklyPayroll(company.id, selected.id))
                      }
                    >
                      Aprobar nómina
                    </Button>
                  ) : null}
                  {selected.status !== "draft" ? (
                    <Button asChild variant="outline" className="h-10">
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
                  {isAdmin && selected.status !== "draft" ? (
                    <Button
                      variant="outline"
                      className="h-10"
                      disabled={pending}
                      onClick={() => setShowReopenDialog(true)}
                    >
                      <RotateCcw className="size-4" />
                      Reabrir nómina
                    </Button>
                  ) : null}
                </div>
              </div>
            </SurfaceCard>
          ) : (
            <SurfaceCard padding="sm" className="p-0">
              <EmptyState
                icon={CalendarPlus}
                title="Todavía no hay una nómina semanal"
                description="Crea el borrador de la semana para empezar a cargar horas."
              />
            </SurfaceCard>
          )}

          {!selected || selected.status !== "draft" ? (
            <SurfaceCard padding="sm" className="p-0">
              <Accordion
                type="single"
                collapsible
                defaultValue={selected ? undefined : "crear"}
              >
                <AccordionItem value="crear">
                  <AccordionTrigger>
                    <span className="flex-1">Crear nómina semanal</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <form
                      className="flex flex-wrap items-end gap-2"
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
                          className="mt-1 h-10"
                        />
                      </label>
                      <Button type="submit" className="h-10" disabled={pending}>
                        Crear borrador
                      </Button>
                    </form>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </SurfaceCard>
          ) : null}

          {selected ? (
            <SurfaceCard padding="sm" className="p-0">
              <div className="text-muted-foreground grid grid-cols-[1fr_90px_90px_100px_100px_40px] gap-2 border-b px-4 py-2 text-[11px] font-semibold tracking-wide uppercase max-md:hidden">
                <div>Empleado</div>
                <div className="text-right">Rate</div>
                <div className="text-right">Horas</div>
                <div className="text-right">Tips</div>
                <div className="text-right">Total</div>
                <div />
              </div>
              <div className="divide-y px-2">{withHours.map(renderEntry)}</div>
              {withoutHours.length ? (
                <Accordion
                  type="single"
                  collapsible
                  defaultValue={
                    selected.status === "draft" ? "sin-horas" : undefined
                  }
                  className="border-t"
                >
                  <AccordionItem value="sin-horas" className="border-b-0">
                    <AccordionTrigger>
                      <span className="flex-1">
                        Sin horas esta semana ({withoutHours.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      <div className="divide-y">
                        {withoutHours.map(renderEntry)}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </SurfaceCard>
          ) : null}

          {selected ? (
            <div className="bg-background/95 sticky bottom-0 z-20 -mx-4 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pr-16">
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    Total de la semana · {entryState.length}{" "}
                    {entryState.length === 1 ? "empleado" : "empleados"}
                  </span>{" "}
                  <span className="text-lg font-semibold tabular-nums">
                    {money.format(total)}
                  </span>
                </p>
                {selected.status === "draft" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-10"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          saveWeeklyPayrollEntries(
                            company.id,
                            selected.id,
                            payloadFromState(),
                          ),
                        )
                      }
                    >
                      <Save className="size-4" />
                      Guardar borrador
                    </Button>
                    <Button
                      className="h-10"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const saved = await saveWeeklyPayrollEntries(
                            company.id,
                            selected.id,
                            payloadFromState(),
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
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="employees">
          <div className="space-y-5">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Directorio de empleados
                </h2>
                <p className="text-muted-foreground text-sm">
                  Los cambios aplican a borradores actuales y nóminas futuras;
                  las enviadas no cambian.
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
        </TabsContent>

        <TabsContent value="history">
          <SurfaceCard padding="sm" className="p-0">
            {payrolls.length ? (
              <>
                <ul className="divide-border/70 divide-y">
                  {history.items.map((payroll) => (
                    <li key={payroll.id}>
                      <Link
                        href={`/dashboard/payroll?company=${company.id}&payroll=${payroll.id}`}
                        aria-current={
                          payroll.id === selected?.id ? "true" : undefined
                        }
                        className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                      >
                        <span
                          className={`tabular-nums ${payroll.id === selected?.id ? "font-semibold" : ""}`}
                        >
                          {payroll.week_start} — {payroll.week_end}
                        </span>
                        <StatusBadge tone={statusTone[payroll.status]}>
                          {statusLabel[payroll.status]}
                        </StatusBadge>
                      </Link>
                    </li>
                  ))}
                </ul>
                <PaginationBar view={history} onPageChange={setHistoryPage} />
              </>
            ) : (
              <EmptyState
                icon={History}
                title="Sin historial todavía"
                description="Las nóminas semanales aparecerán aquí a medida que se creen."
              />
            )}
          </SurfaceCard>
        </TabsContent>

        {leaveSlot ? (
          <TabsContent value="leave" className="space-y-4">
            {leaveSlot}
          </TabsContent>
        ) : null}
      </Tabs>

      {employeeForm ? (
        <EmployeeDialog
          companyId={company.id}
          employee={employeeForm === "new" ? null : employeeForm}
          isAdmin={isAdmin}
          pending={pending}
          onClose={() => setEmployeeForm(null)}
          onSave={(input) => run(() => savePayrollEmployee(input))}
        />
      ) : null}
      {showReopenDialog && selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-6">
          <SurfaceCard className="w-full max-w-lg rounded-b-none sm:rounded-b-lg">
            <h2 className="text-lg font-semibold">Reabrir nómina</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              La nómina volverá a borrador y conservará todos sus datos. El
              motivo quedará registrado en la auditoría.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const reason = String(
                  new FormData(event.currentTarget).get("reason") ?? "",
                );
                run(() => reopenWeeklyPayroll(company.id, selected.id, reason));
              }}
            >
              <label className="block text-sm">
                Motivo de la reapertura
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={500}
                  rows={4}
                  placeholder="Ej.: Corregir empleados y pagos de la semana."
                  className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setShowReopenDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  Reabrir para corregir
                </Button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      ) : null}
    </div>
  );
}

function EmployeeDialog({
  companyId,
  employee,
  isAdmin,
  pending,
  onClose,
  onSave,
}: {
  companyId: string;
  employee: PayrollEmployee | null;
  isAdmin: boolean;
  pending: boolean;
  onClose: () => void;
  onSave: (input: PayrollEmployeeInput) => void;
}) {
  const [type, setType] = useState<
    "hourly" | "hourly_training" | "fixed_weekly"
  >(employee?.compensation_type ?? "hourly");
  const [workerClassification, setWorkerClassification] = useState<
    PayrollEmployeeInput["workerClassification"]
  >(employee?.worker_classification ?? "w2");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-6">
      <SurfaceCard className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none sm:rounded-b-lg">
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
              workerClassification: isAdmin
                ? workerClassification
                : (employee?.worker_classification ?? "w2"),
              hiringDate: isAdmin
                ? String(data.get("hiringDate") || "") || null
                : (employee?.hiring_date ?? null),
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
          {isAdmin ? (
            <>
              <label className="text-sm">
                Clasificación
                <select
                  value={workerClassification}
                  onChange={(e) =>
                    setWorkerClassification(
                      e.target.value as typeof workerClassification,
                    )
                  }
                  className={`${inputClass} mt-1`}
                >
                  <option value="w2">W2 (nómina)</option>
                  <option value="services">Servicios</option>
                  <option value="contractor">Contratista</option>
                </select>
              </label>
              <label className="text-sm">
                Fecha de contratación
                <Input
                  name="hiringDate"
                  type="date"
                  defaultValue={employee?.hiring_date ?? ""}
                  className="mt-1"
                />
              </label>
            </>
          ) : null}
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
