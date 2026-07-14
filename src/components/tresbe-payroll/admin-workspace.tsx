"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  FileText,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";

import {
  cancelTresbePayroll,
  createTresbePayroll,
  emailTresbePayroll,
  recalculateTresbePayroll,
  reopenTresbePayroll,
  resetTresbePayrollDraft,
  saveTresbeEmployee,
  saveTresbePayrollDraft,
  saveTresbePayrollSettings,
  sendTresbePayrollToClient,
  setTresbeEmployeeActive,
  type TresbeEmployeeInput,
} from "@/actions/tresbe-payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  calculateTresbeEntry,
  TRESBE_RULE_LABELS,
  type TresbePayrollRule,
} from "@/lib/tresbe-payroll/calculations";
import type {
  TresbeEmployee,
  TresbePayroll,
  TresbePayrollEntry,
  TresbePayrollSettings,
  TresbeWageReviewItem,
} from "@/services/tresbe-payroll";

type Company = { id: string; name: string; slug: string };
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const statusLabel: Record<TresbePayroll["status"], string> = {
  draft: "Borrador",
  calculated: "Calculada",
  sent: "Enviada",
  viewed: "Vista por cliente",
  corrected: "Corregida",
  cancelled: "Cancelada",
};

function toCalculation(entry: TresbePayrollEntry) {
  return calculateTresbeEntry({
    payrollRule: entry.payroll_rule_snapshot,
    totalWeeklyHours: Number(entry.total_weekly_hours),
    regularRate: entry.regular_rate_snapshot,
    serviceRate: entry.service_rate_snapshot,
    weeklySalary: entry.weekly_salary_snapshot,
    manualSystemAmount: Number(entry.manual_system_amount),
    tips: Number(entry.tips),
    fixedServiceAmount: Number(entry.fixed_service_amount),
    otherAdjustments: Number(entry.other_adjustments),
  });
}

export function TresbePayrollAdminWorkspace({
  company,
  employees,
  payrolls,
  selected,
  entries,
  settings,
  wageReviews,
}: {
  company: Company;
  employees: TresbeEmployee[];
  payrolls: TresbePayroll[];
  selected: TresbePayroll | null;
  entries: TresbePayrollEntry[];
  settings: TresbePayrollSettings | null;
  wageReviews: TresbeWageReviewItem[];
}) {
  const [tab, setTab] = useState<"weekly" | "employees" | "settings">("weekly");
  const [entryState, setEntryState] = useState(entries);
  const [employeeForm, setEmployeeForm] = useState<
    TresbeEmployee | "new" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adminNote, setAdminNote] = useState(selected?.admin_note ?? "");
  const [clientNote, setClientNote] = useState(selected?.client_note ?? "");
  const [emailRecipient, setEmailRecipient] = useState(
    selected?.email_recipient ?? settings?.default_email_recipient ?? "",
  );
  const editable = Boolean(
    selected && ["draft", "calculated", "corrected"].includes(selected.status),
  );
  const calculated = useMemo(
    () => entryState.map((entry) => ({ entry, ...toCalculation(entry) })),
    [entryState],
  );
  const totals = useMemo(
    () =>
      calculated.reduce(
        (sum, row) => ({
          system: sum.system + row.systemPay,
          tips: sum.tips + Number(row.entry.tips),
          services: sum.services + row.serviceCheckAmount,
          adjustments: sum.adjustments + Number(row.entry.other_adjustments),
          grand: sum.grand + row.employeeTotal,
          hours: sum.hours + Number(row.entry.total_weekly_hours),
        }),
        { system: 0, tips: 0, services: 0, adjustments: 0, grand: 0, hours: 0 },
      ),
    [calculated],
  );
  const updateEntry = (
    id: string,
    field: keyof TresbePayrollEntry,
    value: string,
  ) =>
    setEntryState((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: ["comment", "service_reason"].includes(field)
                ? value
                : Number(value || 0),
            }
          : entry,
      ),
    );
  const run = (
    operation: () => Promise<{
      error?: string;
      success?: boolean;
      payrollId?: string;
      message?: string;
    }>,
  ) =>
    startTransition(async () => {
      setMessage(null);
      const result = await operation();
      setMessage(result.error ?? result.message ?? "Guardado correctamente.");
      if (result.success) {
        const target = result.payrollId
          ? `?payroll=${result.payrollId}`
          : window.location.search;
        window.location.href = `${window.location.pathname}${target}`;
      }
    });
  const draftPayload = () => ({
    companyId: company.id,
    payrollId: selected!.id,
    adminNote: adminNote || null,
    clientNote: clientNote || null,
    emailRecipient: emailRecipient || null,
    entries: entryState.map((entry) => ({
      id: entry.id,
      totalWeeklyHours: Number(entry.total_weekly_hours),
      regularRate:
        entry.regular_rate_snapshot == null
          ? null
          : Number(entry.regular_rate_snapshot),
      serviceRate:
        entry.service_rate_snapshot == null
          ? null
          : Number(entry.service_rate_snapshot),
      weeklySalary:
        entry.weekly_salary_snapshot == null
          ? null
          : Number(entry.weekly_salary_snapshot),
      manualSystemAmount: Number(entry.manual_system_amount),
      tips: Number(entry.tips),
      fixedServiceAmount: Number(entry.fixed_service_amount),
      otherAdjustments: Number(entry.other_adjustments),
      serviceReason: (entry.service_reason || null) as
        | "Horas sobre 40"
        | "Empleado por servicios"
        | "Ajuste manual"
        | "Otro"
        | null,
      comment: entry.comment || null,
    })),
  });
  const previewPdf = () => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      setMessage("Permite ventanas emergentes para abrir la vista previa PDF.");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const saved = await saveTresbePayrollDraft(draftPayload());
      if (saved.error) {
        previewWindow.close();
        setMessage(saved.error);
        return;
      }
      const recalculated = await recalculateTresbePayroll(
        company.id,
        selected!.id,
      );
      if (recalculated.error) {
        previewWindow.close();
        setMessage(recalculated.error);
        return;
      }
      previewWindow.location.href = `/api/tresbe-payroll/${selected!.id}/pdf?preview=${Date.now()}`;
      setMessage("Vista previa actualizada correctamente.");
    });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/dashboard/admin/companies/${company.id}`}>
            <ArrowLeft className="size-4" />
            Volver a {company.name}
          </Link>
        </Button>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Administrador · Solo Tresbe
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Preparación de nómina
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Nómina del sistema, tips y cheques de servicios calculados por
            separado.
          </p>
        </div>
      </header>

      <div className="bg-muted flex flex-wrap gap-1 rounded-lg p-1 sm:w-fit">
        {(
          [
            ["weekly", "Nóminas"],
            ["employees", "Empleados"],
            ["settings", "Correo"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={tab === value ? "default" : "ghost"}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
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
          {!selected || !editable ? (
            <SurfaceCard>
              <h2 className="font-semibold">Crear nómina semanal</h2>
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const weekStart = String(
                    new FormData(event.currentTarget).get("weekStart") ?? "",
                  );
                  run(() => createTresbePayroll(company.id, weekStart));
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

          {payrolls.length ? (
            <SurfaceCard padding="sm">
              <div className="flex flex-wrap gap-2">
                {payrolls.map((payroll) => (
                  <Button
                    key={payroll.id}
                    asChild
                    size="sm"
                    variant={
                      payroll.id === selected?.id ? "default" : "outline"
                    }
                  >
                    <Link href={`?payroll=${payroll.id}`}>
                      {payroll.week_start} · {statusLabel[payroll.status]}
                    </Link>
                  </Button>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-xs">
                  <thead className="border-b">
                    <tr>
                      <th className="py-2">Periodo</th>
                      <th>Estado</th>
                      <th>Creada</th>
                      <th>Enviada</th>
                      <th>Vista</th>
                      <th>Empleados</th>
                      <th>Horas</th>
                      <th>Sistema</th>
                      <th>Tips</th>
                      <th>Servicios</th>
                      <th>Total</th>
                      <th>Correo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map((payroll) => (
                      <tr key={payroll.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            className="font-medium underline-offset-4 hover:underline"
                            href={`?payroll=${payroll.id}`}
                          >
                            {payroll.week_start} — {payroll.week_end}
                          </Link>
                        </td>
                        <td>{statusLabel[payroll.status]}</td>
                        <td>{payroll.created_at.slice(0, 10)}</td>
                        <td>{payroll.sent_at?.slice(0, 10) ?? "—"}</td>
                        <td>{payroll.viewed_at?.slice(0, 10) ?? "—"}</td>
                        <td>{payroll.employee_count}</td>
                        <td>{payroll.total_weekly_hours}</td>
                        <td>{money.format(payroll.total_system_pay)}</td>
                        <td>{money.format(payroll.total_tips)}</td>
                        <td>{money.format(payroll.total_service_checks)}</td>
                        <td className="font-medium">
                          {money.format(payroll.grand_total)}
                        </td>
                        <td>{payroll.email_status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          ) : null}

          {selected ? (
            <>
              <SurfaceCard>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">
                      Periodo
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">
                      {selected.week_start} — {selected.week_end}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {statusLabel[selected.status]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs uppercase">
                      Total general
                    </p>
                    <p className="mt-1 text-2xl font-semibold">
                      {money.format(
                        editable ? totals.grand : selected.grand_total,
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Nota interna
                    <textarea
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                      disabled={!editable}
                      maxLength={2000}
                      rows={3}
                      className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    Mensaje visible para Tresbe
                    <textarea
                      value={clientNote}
                      onChange={(event) => setClientNote(event.target.value)}
                      disabled={!editable}
                      maxLength={2000}
                      rows={3}
                      className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </SurfaceCard>

              <div className="space-y-3">
                {editable ? (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setEmployeeForm("new")}
                    >
                      <Plus className="size-4" /> Agregar empleado al borrador
                    </Button>
                  </div>
                ) : null}
                {entryState.map((entry, index) => {
                  const result = toCalculation(entry);
                  const rule = entry.payroll_rule_snapshot;
                  const service = result.serviceCheckAmount > 0;
                  return (
                    <Fragment key={entry.id}>
                      {index === 0 ||
                      entryState[index - 1]?.area_snapshot !==
                        entry.area_snapshot ? (
                        <h2 className="text-muted-foreground pt-3 text-sm font-semibold tracking-wide uppercase">
                          {entry.area_snapshot}
                        </h2>
                      ) : null}
                      <SurfaceCard padding="sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-medium">
                              {entry.employee_name_snapshot}
                            </h3>
                            <p className="text-muted-foreground text-xs">
                              {entry.area_snapshot} · {TRESBE_RULE_LABELS[rule]}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Number(entry.total_weekly_hours) > 40 ? (
                                <span className="text-xs font-medium text-amber-700">
                                  Más de 40 horas
                                </span>
                              ) : null}
                              {service ? (
                                <span className="text-xs font-medium text-red-700">
                                  Genera cheque de servicios
                                </span>
                              ) : null}
                              {entry.is_new_employee ? (
                                <span className="text-xs font-medium text-blue-700">
                                  Empleado nuevo esta semana
                                </span>
                              ) : null}
                              {entry.receives_proportional_tips_snapshot ? (
                                <span className="text-xs font-medium text-emerald-700">
                                  Elegible para propina proporcional
                                </span>
                              ) : null}
                              {rule === "unconfigured" ? (
                                <span className="text-xs font-medium text-red-700">
                                  Regla de pago pendiente
                                </span>
                              ) : null}
                              {rule === "full_services" ? (
                                <span className="text-xs font-medium text-red-700">
                                  Pago completo por servicios
                                </span>
                              ) : null}
                              {Number(entry.other_adjustments) !== 0 ? (
                                <span className="text-xs font-medium text-amber-700">
                                  Incluye ajuste manual
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="font-semibold">
                            {money.format(result.employeeTotal)}
                          </p>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          <NumericField
                            label={
                              rule === "full_services"
                                ? "Horas servicio"
                                : "Horas semanales"
                            }
                            value={entry.total_weekly_hours}
                            disabled={!editable}
                            onChange={(value) =>
                              updateEntry(entry.id, "total_weekly_hours", value)
                            }
                          />
                          {rule === "standard_hourly_40_plus_services" ? (
                            <>
                              <NumericField
                                label="Tarifa regular"
                                value={entry.regular_rate_snapshot}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "regular_rate_snapshot",
                                    value,
                                  )
                                }
                              />
                              <NumericField
                                label="Tarifa servicio"
                                value={entry.service_rate_snapshot}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "service_rate_snapshot",
                                    value,
                                  )
                                }
                              />
                              <NumericField
                                label="Cheque manual (override)"
                                value={entry.fixed_service_amount}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "fixed_service_amount",
                                    value,
                                  )
                                }
                              />
                            </>
                          ) : null}
                          {rule === "full_services" ? (
                            <>
                              <NumericField
                                label="Tarifa servicio"
                                value={entry.service_rate_snapshot}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "service_rate_snapshot",
                                    value,
                                  )
                                }
                              />
                              <NumericField
                                label="Servicio fijo"
                                value={entry.fixed_service_amount}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "fixed_service_amount",
                                    value,
                                  )
                                }
                              />
                            </>
                          ) : null}
                          {[
                            "full_services",
                            "preset_40_weekly_salary",
                            "fixed_weekly_salary",
                          ].includes(rule) ? (
                            <NumericField
                              label="Salario semanal"
                              value={entry.weekly_salary_snapshot}
                              disabled={!editable}
                              onChange={(value) =>
                                updateEntry(
                                  entry.id,
                                  "weekly_salary_snapshot",
                                  value,
                                )
                              }
                            />
                          ) : null}
                          {rule === "custom_manual" ? (
                            <>
                              <NumericField
                                label="Monto sistema"
                                value={entry.manual_system_amount}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "manual_system_amount",
                                    value,
                                  )
                                }
                              />
                              <NumericField
                                label="Monto servicios"
                                value={entry.fixed_service_amount}
                                disabled={!editable}
                                onChange={(value) =>
                                  updateEntry(
                                    entry.id,
                                    "fixed_service_amount",
                                    value,
                                  )
                                }
                              />
                            </>
                          ) : null}
                          <NumericField
                            label="Tips"
                            value={entry.tips}
                            disabled={!editable}
                            onChange={(value) =>
                              updateEntry(entry.id, "tips", value)
                            }
                          />
                          <NumericField
                            label="Otros ajustes"
                            value={entry.other_adjustments}
                            disabled={!editable}
                            allowNegative
                            onChange={(value) =>
                              updateEntry(entry.id, "other_adjustments", value)
                            }
                          />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {service || rule === "custom_manual" ? (
                            <label className="text-muted-foreground text-xs">
                              Motivo del servicio
                              <select
                                value={entry.service_reason ?? ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updateEntry(
                                    entry.id,
                                    "service_reason",
                                    event.target.value,
                                  )
                                }
                                className={`${inputClass} mt-1`}
                              >
                                <option value="">Automático</option>
                                <option>Horas sobre 40</option>
                                <option>Empleado por servicios</option>
                                <option>Ajuste manual</option>
                                <option>Otro</option>
                              </select>
                            </label>
                          ) : null}
                          <label className="text-muted-foreground text-xs">
                            Comentario
                            <Input
                              value={entry.comment ?? ""}
                              maxLength={1000}
                              disabled={!editable}
                              onChange={(event) =>
                                updateEntry(
                                  entry.id,
                                  "comment",
                                  event.target.value,
                                )
                              }
                              className="mt-1"
                            />
                          </label>
                        </div>
                        <div className="bg-muted/50 mt-4 grid gap-2 rounded-lg p-3 text-xs sm:grid-cols-5">
                          <span>H. sistema: {result.systemHours}</span>
                          <span>
                            Pago sistema: {money.format(result.systemPay)}
                          </span>
                          <span>H. servicio: {result.serviceHours}</span>
                          <span>
                            Cheque: {money.format(result.serviceCheckAmount)}
                          </span>
                          <strong>
                            Total: {money.format(result.employeeTotal)}
                          </strong>
                        </div>
                      </SurfaceCard>
                    </Fragment>
                  );
                })}
              </div>

              <PayrollSummary entries={entryState} />

              {editable ? (
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() => saveTresbePayrollDraft(draftPayload()))
                    }
                  >
                    <Save className="size-4" /> Guardar borrador
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const saved =
                          await saveTresbePayrollDraft(draftPayload());
                        return saved.error
                          ? saved
                          : recalculateTresbePayroll(company.id, selected.id);
                      })
                    }
                  >
                    Recalcular
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={previewPdf}
                  >
                    <FileText className="size-4" /> Vista previa PDF
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const saved =
                          await saveTresbePayrollDraft(draftPayload());
                        return saved.error
                          ? saved
                          : sendTresbePayrollToClient({
                              companyId: company.id,
                              payrollId: selected.id,
                              clientNote: clientNote || null,
                              emailRecipient: emailRecipient || null,
                            });
                      })
                    }
                  >
                    <Send className="size-4" /> Enviar a Tresbe
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      const reason = window.prompt("Motivo de cancelación");
                      if (reason)
                        run(() =>
                          cancelTresbePayroll(company.id, selected.id, reason),
                        );
                    }}
                  >
                    Cancelar nómina
                  </Button>
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      const reason = window.prompt(
                        "Motivo para descartar los datos y empezar de nuevo",
                      );
                      if (reason)
                        run(() =>
                          resetTresbePayrollDraft(
                            company.id,
                            selected.id,
                            reason,
                          ),
                        );
                    }}
                  >
                    <Trash2 className="size-4" /> Descartar y empezar de nuevo
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-3">
                  {["sent", "viewed", "corrected"].includes(selected.status) ? (
                    <>
                      <Button asChild variant="outline">
                        <a
                          href={`/api/tresbe-payroll/${selected.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText className="size-4" /> Ver PDF
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          const reason = window.prompt(
                            "Motivo de la corrección (mínimo 10 caracteres)",
                          );
                          if (reason)
                            run(() =>
                              reopenTresbePayroll(
                                company.id,
                                selected.id,
                                reason,
                              ),
                            );
                        }}
                      >
                        <RotateCcw className="size-4" /> Reabrir para corregir
                      </Button>
                      <Input
                        type="email"
                        value={emailRecipient}
                        onChange={(event) =>
                          setEmailRecipient(event.target.value)
                        }
                        placeholder="correo@tresbe.com"
                        className="max-w-xs"
                      />
                      <Button
                        disabled={pending || !emailRecipient}
                        onClick={() =>
                          run(() =>
                            emailTresbePayroll(
                              company.id,
                              selected.id,
                              emailRecipient,
                            ),
                          )
                        }
                      >
                        <Mail className="size-4" /> Enviar PDF por correo
                      </Button>
                    </>
                  ) : selected.status === "cancelled" ? (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt(
                          "Motivo para rehacer esta nómina",
                        );
                        if (reason)
                          run(() =>
                            resetTresbePayrollDraft(
                              company.id,
                              selected.id,
                              reason,
                            ),
                          );
                      }}
                    >
                      <RotateCcw className="size-4" /> Rehacer nómina
                    </Button>
                  ) : null}
                </div>
              )}
              {selected.email_status ? (
                <p className="text-muted-foreground text-right text-xs">
                  Correo: {selected.email_status}
                  {selected.email_error ? ` · ${selected.email_error}` : ""}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "employees" ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Directorio de empleados</h2>
              <p className="text-muted-foreground text-sm">
                Los cambios aplican a nóminas abiertas y futuras, nunca al
                historial enviado.
              </p>
            </div>
            <Button onClick={() => setEmployeeForm("new")}>
              <Plus className="size-4" /> Agregar empleado
            </Button>
          </div>
          {wageReviews.length ? (
            <SurfaceCard className="border-amber-200 bg-amber-50/40">
              <h2 className="font-semibold">Revisión de salarios</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Elementos que no se actualizaron automáticamente desde el
                reporte oficial del 13 de julio de 2026.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                {wageReviews.map((review) => {
                  const employee = employees.find(
                    (item) => item.id === review.employee_id,
                  );
                  return (
                    <div
                      key={review.id}
                      className="rounded-md border bg-white p-3"
                    >
                      <p className="font-medium">
                        {review.official_name ??
                          employee?.display_name ??
                          "Empleado"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {review.source_name ? `${review.source_name} · ` : ""}
                        {employee ? `${employee.area} · ` : ""}
                        {review.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          ) : null}
          {employees.map((employee) => (
            <SurfaceCard key={employee.id} padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium">{employee.display_name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {employee.area} ·{" "}
                    {TRESBE_RULE_LABELS[employee.payroll_rule]}
                    {employee.receives_proportional_tips
                      ? " · Propina proporcional"
                      : ""}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Regular {money.format(employee.regular_hourly_rate ?? 0)} ·
                    Servicio {money.format(employee.service_hourly_rate ?? 0)} ·
                    Semanal {money.format(employee.default_weekly_salary ?? 0)}
                  </p>
                  {employee.annual_salary != null ? (
                    <p className="text-muted-foreground text-xs">
                      Salario anual {money.format(employee.annual_salary)}
                    </p>
                  ) : null}
                  {employee.wage_requires_review ? (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      {employee.wage_review_reason ??
                        "Salario requiere revisión"}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEmployeeForm(employee)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setTresbeEmployeeActive(
                          company.id,
                          employee.id,
                          !employee.is_active,
                        ),
                      )
                    }
                  >
                    {employee.is_active ? "Desactivar" : "Reactivar"}
                  </Button>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      ) : null}

      {tab === "settings" ? (
        <SurfaceCard className="max-w-xl">
          <h2 className="font-semibold">Configuración de correo</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            El envío requiere las credenciales server-side del proveedor.
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run(() =>
                saveTresbePayrollSettings({
                  companyId: company.id,
                  defaultEmailRecipient:
                    String(data.get("recipient") || "") || null,
                  emailCc: String(data.get("cc") || "") || null,
                }),
              );
            }}
          >
            <label className="block text-sm">
              Destinatario predeterminado
              <Input
                name="recipient"
                type="email"
                defaultValue={settings?.default_email_recipient ?? ""}
                className="mt-1"
              />
            </label>
            <label className="block text-sm">
              Copia (CC)
              <Input
                name="cc"
                type="email"
                defaultValue={settings?.email_cc ?? ""}
                className="mt-1"
              />
            </label>
            <Button type="submit" disabled={pending}>
              Guardar configuración
            </Button>
          </form>
        </SurfaceCard>
      ) : null}

      {employeeForm ? (
        <TresbeEmployeeDialog
          companyId={company.id}
          employee={employeeForm === "new" ? null : employeeForm}
          pending={pending}
          onClose={() => setEmployeeForm(null)}
          onSave={(input) => run(() => saveTresbeEmployee(input))}
        />
      ) : null}
    </div>
  );
}

function NumericField({
  label,
  value,
  disabled,
  allowNegative = false,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  allowNegative?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-muted-foreground text-xs">
      {label}
      <Input
        type="number"
        min={allowNegative ? undefined : "0"}
        step="0.01"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </label>
  );
}

function PayrollSummary({ entries }: { entries: TresbePayrollEntry[] }) {
  const rows = entries.map((entry) => ({
    entry,
    result: toCalculation(entry),
  }));
  const totals = rows.reduce(
    (sum, row) => ({
      system: sum.system + row.result.systemPay,
      tips: sum.tips + Number(row.entry.tips),
      services: sum.services + row.result.serviceCheckAmount,
      adjustments: sum.adjustments + Number(row.entry.other_adjustments),
      grand: sum.grand + row.result.employeeTotal,
    }),
    { system: 0, tips: 0, services: 0, adjustments: 0, grand: 0 },
  );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SurfaceCard>
        <h2 className="font-semibold">Resumen del sistema</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b">
              <tr>
                <th className="py-2">Empleado</th>
                <th>Sistema</th>
                <th>Tips</th>
                <th>Servicios</th>
                <th>Ajustes</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, result }) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-2">{entry.employee_name_snapshot}</td>
                  <td>{money.format(result.systemPay)}</td>
                  <td>{money.format(entry.tips)}</td>
                  <td>{money.format(result.serviceCheckAmount)}</td>
                  <td>{money.format(entry.other_adjustments)}</td>
                  <td className="font-medium">
                    {money.format(result.employeeTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 space-y-2 border-t pt-4 text-sm">
          <SummaryLine label="TOTAL NÓMINA EN SISTEMA" value={totals.system} />
          <SummaryLine label="TOTAL TIPS" value={totals.tips} />
          <SummaryLine
            label="TOTAL CHEQUES DE SERVICIOS"
            value={totals.services}
          />
          <SummaryLine label="TOTAL AJUSTES" value={totals.adjustments} />
          <SummaryLine
            label="TOTAL GENERAL A PAGAR"
            value={totals.grand}
            strong
          />
        </div>
      </SurfaceCard>
      <SurfaceCard>
        <h2 className="font-semibold">Cheques de servicios</h2>
        <div className="mt-4 space-y-3">
          {rows.filter((row) => row.result.serviceCheckAmount > 0).length ? (
            rows
              .filter((row) => row.result.serviceCheckAmount > 0)
              .map(({ entry, result }) => (
                <div key={entry.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <strong>{entry.employee_name_snapshot}</strong>
                    <strong>{money.format(result.serviceCheckAmount)}</strong>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {entry.service_reason ??
                      (entry.payroll_rule_snapshot === "full_services"
                        ? "Empleado por servicios"
                        : "Horas sobre 40")}{" "}
                    · {result.serviceHours} horas
                  </p>
                </div>
              ))
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay cheques de servicios en esta semana.
            </p>
          )}
        </div>
        <SummaryLine
          label="TOTAL CHEQUES DE SERVICIOS"
          value={totals.services}
          strong
        />
      </SurfaceCard>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span>{money.format(value)}</span>
    </div>
  );
}

function TresbeEmployeeDialog({
  companyId,
  employee,
  pending,
  onClose,
  onSave,
}: {
  companyId: string;
  employee: TresbeEmployee | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: TresbeEmployeeInput) => void;
}) {
  const [rule, setRule] = useState<TresbePayrollRule>(
    employee?.payroll_rule ?? "unconfigured",
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-6">
      <SurfaceCard className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none sm:rounded-b-2xl">
        <h2 className="text-lg font-semibold">
          {employee ? "Editar empleado" : "Agregar empleado"}
        </h2>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const numeric = (name: string) =>
              data.get(name) === "" ? null : Number(data.get(name));
            onSave({
              id: employee?.id,
              companyId,
              firstName: String(data.get("firstName")),
              lastName: String(data.get("lastName") || "") || null,
              area: String(data.get("area")),
              paymentMethod: String(
                data.get("paymentMethod"),
              ) as TresbeEmployeeInput["paymentMethod"],
              payrollRule: rule,
              receivesProportionalTips:
                data.get("receivesProportionalTips") === "on",
              regularRate: numeric("regularRate"),
              serviceRate: numeric("serviceRate"),
              defaultHours: numeric("defaultHours"),
              defaultSalary: numeric("defaultSalary"),
              annualSalary: numeric("annualSalary"),
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
            Apellido (opcional)
            <Input
              name="lastName"
              defaultValue={employee?.last_name ?? ""}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Área
            <Input
              name="area"
              required
              defaultValue={employee?.area}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Método de pago
            <select
              name="paymentMethod"
              defaultValue={employee?.payment_method ?? "mixed"}
              className={`${inputClass} mt-1`}
            >
              <option value="payroll_system">Sistema de nómina</option>
              <option value="services">Servicios</option>
              <option value="mixed">Mixto</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Regla de nómina
            <select
              value={rule}
              onChange={(event) =>
                setRule(event.target.value as TresbePayrollRule)
              }
              className={`${inputClass} mt-1`}
            >
              {Object.entries(TRESBE_RULE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              name="receivesProportionalTips"
              type="checkbox"
              defaultChecked={employee?.receives_proportional_tips ?? false}
            />
            Recibe propinas proporcionales
          </label>
          <label className="text-sm">
            Tarifa regular
            <Input
              name="regularRate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={employee?.regular_hourly_rate ?? ""}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Tarifa de servicios
            <Input
              name="serviceRate"
              type="number"
              min="0"
              step="0.01"
              defaultValue={employee?.service_hourly_rate ?? ""}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Horas semanales predeterminadas
            <Input
              name="defaultHours"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                rule === "preset_40_weekly_salary"
                  ? 40
                  : (employee?.default_weekly_hours ?? "")
              }
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Salario semanal predeterminado
            <Input
              name="defaultSalary"
              type="number"
              min="0"
              step="0.01"
              defaultValue={employee?.default_weekly_salary ?? ""}
              className="mt-1"
            />
          </label>
          <label className="text-sm">
            Salario anual
            <Input
              name="annualSalary"
              type="number"
              min="0"
              step="0.01"
              defaultValue={employee?.annual_salary ?? ""}
              className="mt-1"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Nota interna
            <textarea
              name="internalNote"
              maxLength={1000}
              defaultValue={employee?.internal_note ?? ""}
              rows={3}
              className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              Guardar empleado
            </Button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
}
