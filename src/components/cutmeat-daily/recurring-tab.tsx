"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { deleteRecurrente, markRecurrentePaid, saveRecurrente } from "@/actions/cutmeat-recurrentes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type { CutMeatRecurringPayment } from "@/services/cutmeat-daily";
import type { IsoDate } from "@/lib/cutmeat-daily/dates";

type FormState = {
  id?: string;
  period: string;
  fecha: string;
  trType: string;
  num: string;
  vendor: string;
  dueDate: string;
  amount: string;
  notes: string;
};

function monthStartOf(date: IsoDate): string {
  return `${date.slice(0, 7)}-01`;
}

function emptyForm(reportDate: IsoDate): FormState {
  return {
    period: monthStartOf(reportDate),
    fecha: reportDate,
    trType: "",
    num: "",
    vendor: "",
    dueDate: reportDate,
    amount: "",
    notes: "",
  };
}

/**
 * Fuente única de recurrentes: cutmeat_recurrentes (Fase 1) -- la tabla
 * vieja cutmeat_daily_recurring_payments se retiró por migración (ver
 * docs/CUTMEAT_DAILY_DATA_CONTRACT.md). Alta/edición de datos vía saveRecurrente; marcar
 * pagado/monto real vía markRecurrentePaid (la interacción principal
 * del día: mientras se reconcilia el banco, se marca qué recurrente ya
 * se pagó y con qué monto real). El detalle completo de recurrentes del
 * mes vive en /dashboard/admin/companies/{companyId}/recurrentes
 * (Fase 1); esta pestaña es la vista de trabajo del día.
 */
export function RecurringTab({
  companyId,
  reportDate,
  recurring,
}: {
  companyId: string;
  reportDate: IsoDate;
  recurring: CutMeatRecurringPayment[];
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(reportDate));
  const [paidAmounts, setPaidAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const submit = () => {
    if (!form.vendor.trim() || !Number(form.amount)) {
      setMessage("Completá proveedor y monto.");
      return;
    }
    startTransition(async () => {
      const result = await saveRecurrente({
        id: form.id,
        companyId,
        period: form.period,
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
      setForm(emptyForm(reportDate));
      setMessage("Recurrente guardado.");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteRecurrente({ companyId, id });
      setMessage("error" in result ? result.error : "Recurrente eliminado.");
      router.refresh();
    });
  };

  const togglePaid = (item: CutMeatRecurringPayment) => {
    startTransition(async () => {
      const paid = !item.isPaid;
      const paidAmount = paidAmounts[item.id] ? Number(paidAmounts[item.id]) : null;
      const paidDate = paid ? reportDate : null;
      const result = await markRecurrentePaid({
        companyId,
        id: item.id,
        paid,
        paidDate,
        paidAmount,
      });
      setMessage("error" in result ? result.error : paid ? "Marcado pagado." : "Marcado pendiente.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <h2 className="text-base font-semibold">
          {form.id ? "Editar recurrente" : "Nuevo recurrente"}
        </h2>
        <p className="text-muted-foreground text-sm">
          El detalle completo del mes se edita en la pantalla de
          Recurrentes; acá se puede agregar uno nuevo o corregir uno
          existente sin salir de Informes diarios.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Período (mes)</span>
            <Input
              type="date"
              value={form.period}
              onChange={(e) => update({ period: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Tipo</span>
            <Input value={form.trType} onChange={(e) => update({ trType: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Número</span>
            <Input value={form.num} onChange={(e) => update({ num: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Proveedor</span>
            <Input value={form.vendor} onChange={(e) => update({ vendor: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Fecha</span>
            <Input type="date" value={form.fecha} onChange={(e) => update({ fecha: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Vencimiento</span>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Monto</span>
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => update({ amount: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Notas</span>
            <Input value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={pending}>
            <Plus className="size-4" />
            {form.id ? "Guardar cambios" : "Agregar recurrente"}
          </Button>
          {form.id ? (
            <Button variant="ghost" onClick={() => setForm(emptyForm(reportDate))}>
              Cancelar
            </Button>
          ) : null}
          {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">Recurrentes ({recurring.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs uppercase">
              <th className="px-1 py-1">Proveedor</th>
              <th className="px-1 py-1">Vencimiento</th>
              <th className="px-1 py-1 text-right">Monto</th>
              <th className="px-1 py-1">Estado</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {recurring.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-1 py-1.5">{item.concept}</td>
                <td className="text-muted-foreground px-1 py-1.5">{item.dueDate}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">
                  {formatMoney(item.amount)}
                </td>
                <td className="px-1 py-1.5">
                  {item.isPaid ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                      Pagado{item.actualAmount != null ? ` · ${formatMoney(item.actualAmount)}` : ""}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        inputMode="decimal"
                        placeholder="Monto real"
                        className="h-7 w-24 text-xs"
                        value={paidAmounts[item.id] ?? ""}
                        onChange={(e) =>
                          setPaidAmounts((current) => ({ ...current, [item.id]: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </td>
                <td className="w-28 px-1 py-1.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => togglePaid(item)}
                  >
                    {item.isPaid ? "Desmarcar" : "Marcar pagado"}
                  </Button>
                  <button
                    type="button"
                    aria-label="Editar"
                    className="text-muted-foreground hover:text-foreground p-1"
                    onClick={() =>
                      setForm({
                        id: item.id,
                        period: item.period,
                        fecha: item.entryDate ?? reportDate,
                        trType: item.itemType ?? "",
                        num: item.referenceNumber ?? "",
                        vendor: item.vendor,
                        dueDate: item.dueDate ?? "",
                        amount: String(item.amount),
                        notes: item.note ?? "",
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar"
                    disabled={pending}
                    className="text-muted-foreground hover:text-destructive p-1"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recurring.length === 0 ? (
          <p className="text-muted-foreground px-1 py-2 text-sm">Sin recurrentes cargados.</p>
        ) : null}
      </SurfaceCard>
    </div>
  );
}
