"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Copy, Plus, Trash2 } from "lucide-react";

import {
  copyPreviousMonth,
  deleteRecurrente,
  markRecurrentePaid,
  saveRecurrente,
} from "@/actions/cutmeat-recurrentes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  pendingToConfirm,
  shiftPeriod,
  totalsByWeek,
  type Recurrente,
} from "@/lib/cutmeat-recurrentes/calculations";
import {
  formatDayLabel,
  todayInPuertoRico,
  type IsoDate,
} from "@/lib/cutmeat-daily/dates";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type { CutMeatRecurrente } from "@/services/cutmeat-recurrentes";

type Company = { id: string; name: string; slug: string };

const monthFormat = new Intl.DateTimeFormat("es", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
function formatPeriodLabel(period: IsoDate) {
  const label = monthFormat.format(new Date(`${period}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type FormState = {
  id?: string;
  fecha: string;
  trType: string;
  num: string;
  vendor: string;
  dueDate: string;
  amount: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    fecha: "",
    trType: "",
    num: "",
    vendor: "",
    dueDate: "",
    amount: "",
    notes: "",
  };
}

export function RecurrentesWorkspace({
  company,
  period,
  periods,
  recurrentes,
  canWrite,
}: {
  company: Company;
  period: IsoDate;
  periods: IsoDate[];
  recurrentes: CutMeatRecurrente[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = todayInPuertoRico();

  const asRecurrente = (r: CutMeatRecurrente): Recurrente => ({
    id: r.id,
    vendor: r.vendor,
    dueDate: r.dueDate,
    amount: r.amount,
    pagado: r.pagado,
    paidAmount: r.paidAmount,
  });

  const totals = useMemo(
    () => totalsByWeek(recurrentes.map(asRecurrente), today, 3),
    [recurrentes, today],
  );
  const toConfirm = useMemo(
    () => pendingToConfirm(recurrentes.map(asRecurrente), today),
    [recurrentes, today],
  );
  const toConfirmByVendor = useMemo(
    () => new Map(recurrentes.map((r) => [r.id, r])),
    [recurrentes],
  );

  const goToPeriod = (value: IsoDate) => {
    router.push(
      `/dashboard/admin/companies/${company.id}/recurrentes?period=${value}`,
    );
  };

  const update = (patch: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...patch }));

  const submit = () => {
    if (!form.vendor.trim() || !form.amount) {
      setMessage("Completá proveedor y monto.");
      return;
    }
    startTransition(async () => {
      const result = await saveRecurrente({
        id: form.id,
        companyId: company.id,
        period,
        fecha: form.fecha || null,
        trType: form.trType.trim() || null,
        num: form.num.trim() || null,
        vendor: form.vendor.trim(),
        dueDate: form.dueDate || null,
        amount: Number(form.amount),
        notes: form.notes.trim() || null,
      });
      if ("error" in result) {
        setMessage(result.error ?? null);
        return;
      }
      setForm(emptyForm());
      setMessage("Recurrente guardado.");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    if (!window.confirm("¿Eliminar este recurrente? No se puede deshacer."))
      return;
    startTransition(async () => {
      const result = await deleteRecurrente({ companyId: company.id, id });
      setMessage("error" in result ? result.error : "Recurrente eliminado.");
      router.refresh();
    });
  };

  const togglePaid = (row: CutMeatRecurrente, paid: boolean) => {
    startTransition(async () => {
      const result = await markRecurrentePaid({
        companyId: company.id,
        id: row.id,
        paid,
        paidDate: paid ? (row.paidDate ?? today) : null,
        paidAmount: paid ? (row.paidAmount ?? row.amount) : null,
      });
      setMessage(
        "error" in result
          ? result.error
          : paid
            ? "Marcado pagado."
            : "Marcado pendiente.",
      );
      router.refresh();
    });
  };

  const updatePaidField = (
    row: CutMeatRecurrente,
    patch: { paidDate?: string; paidAmount?: string },
  ) => {
    startTransition(async () => {
      const result = await markRecurrentePaid({
        companyId: company.id,
        id: row.id,
        paid: true,
        paidDate: patch.paidDate ?? row.paidDate ?? today,
        paidAmount:
          patch.paidAmount != null
            ? Number(patch.paidAmount)
            : (row.paidAmount ?? row.amount),
      });
      setMessage("error" in result ? result.error : null);
      router.refresh();
    });
  };

  const copyToNextMonth = () => {
    const toPeriod = shiftPeriod(period, 1);
    if (
      !window.confirm(
        `¿Copiar los ${recurrentes.length} recurrentes de ${formatPeriodLabel(period)} a ${formatPeriodLabel(toPeriod)}? Se copian sin marcar pagados.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await copyPreviousMonth({
        companyId: company.id,
        fromPeriod: period,
        toPeriod,
      });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `${result.copied} recurrentes copiados a ${formatPeriodLabel(toPeriod)}.`,
      );
      goToPeriod(toPeriod);
    });
  };

  return (
    <div className="space-y-5">
      <header className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {company.name} · Recurrentes
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              {formatPeriodLabel(period)}
            </h1>
            {!canWrite ? (
              <p className="text-muted-foreground mt-2 text-sm">
                Modo de solo lectura.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => goToPeriod(shiftPeriod(period, -1))}
            >
              Mes anterior
            </Button>
            <input
              type="month"
              value={period.slice(0, 7)}
              onChange={(event) =>
                event.target.value && goToPeriod(`${event.target.value}-01`)
              }
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            />
            <Button
              variant="outline"
              onClick={() => goToPeriod(shiftPeriod(period, 1))}
            >
              Mes siguiente
            </Button>
            {canWrite ? (
              <Button
                variant="outline"
                disabled={pending || recurrentes.length === 0}
                onClick={copyToNextMonth}
              >
                <Copy className="size-4" />
                Copiar recurrentes del mes anterior
              </Button>
            ) : null}
          </div>
        </div>
        {periods.length ? (
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => goToPeriod(p)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  p === period
                    ? "border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {formatPeriodLabel(p)}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {toConfirm.length ? (
        <SurfaceCard padding="sm" className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3 px-1">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">
                {toConfirm.length} recurrente(s) por confirmar (vencidos al{" "}
                {formatDayLabel(today)} y todavía pendientes):
              </p>
              <p className="mt-1">
                {toConfirm
                  .map((r) => toConfirmByVendor.get(r.id)?.vendor ?? r.vendor)
                  .join(", ")}
              </p>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <h2 className="text-base font-semibold">Total recurrentes a pagar</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-muted-foreground text-xs uppercase">
              Antes de esta semana
            </p>
            <p className="text-lg font-semibold">{formatMoney(totals.prior)}</p>
          </div>
          {totals.weeks.map((week) => (
            <div key={week.weekStart}>
              <p className="text-muted-foreground text-xs uppercase">
                {formatDayLabel(week.weekStart)}–{formatDayLabel(week.weekEnd)}
              </p>
              <p className="text-lg font-semibold">{formatMoney(week.total)}</p>
            </div>
          ))}
          <div>
            <p className="text-muted-foreground text-xs uppercase">Total</p>
            <p className="text-lg font-semibold">{formatMoney(totals.total)}</p>
          </div>
        </div>
        {totals.sinFecha > 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Incluye {formatMoney(totals.sinFecha)} sin fecha de vencimiento.
          </p>
        ) : null}
      </SurfaceCard>

      {canWrite ? (
        <SurfaceCard>
          <h2 className="text-base font-semibold">
            {form.id ? "Editar recurrente" : "Nuevo recurrente"}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Fecha</span>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => update({ fecha: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Tr Type</span>
              <Input
                value={form.trType}
                onChange={(e) => update({ trType: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Num</span>
              <Input
                value={form.num}
                onChange={(e) => update({ num: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Vendor</span>
              <Input
                value={form.vendor}
                onChange={(e) => update({ vendor: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Due Date</span>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Amount</span>
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => update({ amount: e.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-muted-foreground text-xs">Notas</span>
              <Input
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={pending}>
              <Plus className="size-4" />
              {form.id ? "Guardar cambios" : "Agregar recurrente"}
            </Button>
            {form.id ? (
              <Button variant="ghost" onClick={() => setForm(emptyForm())}>
                Cancelar
              </Button>
            ) : null}
            {message ? (
              <span className="text-muted-foreground text-sm">{message}</span>
            ) : null}
          </div>
        </SurfaceCard>
      ) : message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">
          Recurrentes del mes ({recurrentes.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs uppercase">
                <th className="px-2 py-1">Date</th>
                <th className="px-2 py-1">Tr Type</th>
                <th className="px-2 py-1">Num</th>
                <th className="px-2 py-1">Vendor</th>
                <th className="px-2 py-1">Due Date</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1">Pagado</th>
                <th className="px-2 py-1 text-right">Pendiente</th>
                {canWrite ? <th className="px-2 py-1" /> : null}
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {recurrentes.map((row) => (
                <tr
                  key={row.id}
                  className={row.pagado ? "bg-muted/40" : undefined}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.fecha ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.trType ?? "—"}
                  </td>
                  <td className="px-2 py-1.5">{row.num ?? "—"}</td>
                  <td className="px-2 py-1.5">{row.vendor}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {row.dueDate ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatMoney(row.amount)}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.pagado}
                        disabled={!canWrite || pending}
                        onChange={(event) =>
                          togglePaid(row, event.target.checked)
                        }
                      />
                      {row.pagado ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Input
                            type="date"
                            className="h-7 w-32 text-xs"
                            value={row.paidDate ?? ""}
                            disabled={!canWrite}
                            onChange={(event) =>
                              updatePaidField(row, {
                                paidDate: event.target.value,
                              })
                            }
                          />
                          <Input
                            inputMode="decimal"
                            className="h-7 w-20 text-xs"
                            value={row.paidAmount ?? ""}
                            disabled={!canWrite}
                            onChange={(event) =>
                              updatePaidField(row, {
                                paidAmount: event.target.value,
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {row.pagado ? "—" : formatMoney(row.amount)}
                  </td>
                  {canWrite ? (
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        aria-label="Editar"
                        className="text-muted-foreground hover:text-foreground p-1"
                        onClick={() =>
                          setForm({
                            id: row.id,
                            fecha: row.fecha ?? "",
                            trType: row.trType ?? "",
                            num: row.num ?? "",
                            vendor: row.vendor,
                            dueDate: row.dueDate ?? "",
                            amount: String(row.amount),
                            notes: row.notes ?? "",
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        aria-label="Eliminar"
                        disabled={pending}
                        className="text-muted-foreground hover:text-destructive p-1"
                        onClick={() => remove(row.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          {recurrentes.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              Sin recurrentes cargados para este mes.
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
