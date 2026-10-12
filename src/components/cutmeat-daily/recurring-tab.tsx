"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { deleteRecurringPayment, saveRecurringPayment } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { todayInPuertoRico } from "@/lib/cutmeat-daily/dates";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type { CutMeatRecurringPayment } from "@/services/cutmeat-daily";

type FormState = {
  id?: string;
  entryDate: string;
  itemType: string;
  referenceNumber: string;
  vendor: string;
  concept: string;
  dueDate: string;
  amount: string;
  isPaid: boolean;
  actualAmount: string;
  note: string;
};

function emptyForm(): FormState {
  const today = todayInPuertoRico();
  return {
    entryDate: today,
    itemType: "",
    referenceNumber: "",
    vendor: "",
    concept: "",
    dueDate: today,
    amount: "",
    isPaid: false,
    actualAmount: "",
    note: "",
  };
}

export function RecurringTab({
  companyId,
  recurring,
}: {
  companyId: string;
  recurring: CutMeatRecurringPayment[];
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const submit = () => {
    if (!form.concept.trim() || !Number(form.amount)) {
      setMessage("Completá concepto y monto.");
      return;
    }
    startTransition(async () => {
      const result = await saveRecurringPayment({
        id: form.id,
        companyId,
        entryDate: form.entryDate,
        itemType: form.itemType.trim() || null,
        referenceNumber: form.referenceNumber.trim() || null,
        vendor: form.vendor.trim() || null,
        concept: form.concept.trim(),
        dueDate: form.dueDate,
        amount: Number(form.amount),
        isPaid: form.isPaid,
        actualAmount: form.actualAmount ? Number(form.actualAmount) : null,
        note: form.note.trim() || null,
      });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setForm(emptyForm());
      setMessage("Recurrente guardado.");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteRecurringPayment({ companyId, id });
      setMessage("error" in result ? result.error : "Recurrente eliminado.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <h2 className="text-base font-semibold">
          {form.id ? "Editar recurrente" : "Nuevo recurrente del mes"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Tipo</span>
            <Input value={form.itemType} onChange={(e) => update({ itemType: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Número</span>
            <Input
              value={form.referenceNumber}
              onChange={(e) => update({ referenceNumber: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Proveedor</span>
            <Input value={form.vendor} onChange={(e) => update({ vendor: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Concepto</span>
            <Input value={form.concept} onChange={(e) => update({ concept: e.target.value })} />
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPaid}
              onChange={(e) => update({ isPaid: e.target.checked })}
            />
            Pagado
          </label>
          {form.isPaid ? (
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Monto real pagado</span>
              <Input
                inputMode="decimal"
                value={form.actualAmount}
                onChange={(e) => update({ actualAmount: e.target.value })}
              />
            </label>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Nota</span>
            <Input value={form.note} onChange={(e) => update({ note: e.target.value })} />
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
          {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">Recurrentes ({recurring.length})</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs uppercase">
              <th className="px-1 py-1">Concepto</th>
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
                    <span className="text-muted-foreground text-xs">Pendiente</span>
                  )}
                </td>
                <td className="w-20 px-1 py-1.5 text-right">
                  <button
                    type="button"
                    aria-label="Editar"
                    className="text-muted-foreground hover:text-foreground p-1"
                    onClick={() =>
                      setForm({
                        id: item.id,
                        entryDate: item.entryDate,
                        itemType: item.itemType ?? "",
                        referenceNumber: item.referenceNumber ?? "",
                        vendor: item.vendor ?? "",
                        concept: item.concept,
                        dueDate: item.dueDate,
                        amount: String(item.amount),
                        isPaid: item.isPaid,
                        actualAmount: item.actualAmount != null ? String(item.actualAmount) : "",
                        note: item.note ?? "",
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
