"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteBudgetMovement,
  saveBudgetMovement,
} from "@/actions/tresbe-budget";
import { messageFrom } from "@/lib/tresbe-budget/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { categoryHintFor } from "@/lib/tresbe-budget/category-hints";
import { formatDayLabel, weekDates } from "@/lib/tresbe-budget/dates";
import { formatMoney } from "@/lib/tresbe-budget/format";
import type { BudgetCategory, BudgetMovement } from "@/services/tresbe-budget";
import { cn } from "@/lib/utils";

const selectClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]";

type FormState = {
  id?: string;
  entryDate: string;
  direction: "ingreso" | "egreso";
  categoryId: string;
  concept: string;
  counterparty: string;
  amount: string;
  account: string;
  note: string;
};

function emptyForm(entryDate: string): FormState {
  return {
    entryDate,
    direction: "egreso",
    categoryId: "",
    concept: "",
    counterparty: "",
    amount: "",
    account: "Banco Popular",
    note: "",
  };
}

export function MovementsTab({
  companyId,
  weekStart,
  categories,
  movements,
}: {
  companyId: string;
  weekStart: string;
  categories: BudgetCategory[];
  movements: BudgetMovement[];
}) {
  const dates = weekDates(weekStart);
  const [form, setForm] = useState<FormState>(() => emptyForm(dates[0]));
  const [override, setOverride] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories],
  );
  const categoriesByCode = useMemo(
    () => new Map(categories.map((item) => [item.code, item])),
    [categories],
  );
  const available = categories.filter(
    (category) =>
      category.is_active &&
      (category.kind === "financiamiento" || category.kind === form.direction),
  );

  const hint = categoryHintFor(form.concept, form.counterparty);
  const hintCategory = hint ? categoriesByCode.get(hint.code) : null;
  const hintMismatch = Boolean(
    hint &&
    form.categoryId &&
    hintCategory &&
    hintCategory.id !== form.categoryId,
  );

  const update = (patch: Partial<FormState>) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      // El sentido manda: si cambia, una categoría incompatible se descarta.
      if (patch.direction && next.categoryId) {
        const category = categoriesById.get(next.categoryId);
        if (
          category &&
          category.kind !== "financiamiento" &&
          category.kind !== next.direction
        ) {
          next.categoryId = "";
        }
      }
      // Clover y los barridos de reserva se autocompletan al escribir.
      if ((patch.concept != null || patch.counterparty != null) && !next.id) {
        const suggestion = categoryHintFor(next.concept, next.counterparty);
        const target = suggestion
          ? categoriesByCode.get(suggestion.code)
          : null;
        if (
          target &&
          (target.kind === "financiamiento" ||
            target.kind === next.direction) &&
          !current.categoryId
        ) {
          next.categoryId = target.id;
        }
      }
      return next;
    });
  };

  const submit = () => {
    const amount = Number(form.amount);
    if (!form.categoryId) {
      setMessage("Elegí una categoría.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("El importe debe ser mayor a 0.");
      return;
    }
    startTransition(async () => {
      const result = await saveBudgetMovement({
        id: form.id,
        companyId,
        entryDate: form.entryDate,
        direction: form.direction,
        categoryId: form.categoryId,
        concept: form.concept.trim(),
        counterparty: form.counterparty.trim() || null,
        amount: Math.round(amount * 100) / 100,
        account: form.account.trim() || null,
        note: form.note.trim() || null,
        overrideHint: override,
      });
      if ("error" in result) {
        setMessage(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }
      setForm(emptyForm(form.entryDate));
      setOverride(false);
      setMessage("Movimiento guardado.");
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteBudgetMovement({ companyId, id });
      setMessage(messageFrom(result, "Movimiento eliminado."));
    });
  };

  const byDate = dates.map((date) => ({
    date,
    rows: movements.filter((movement) => movement.entry_date === date),
  }));

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <h2 className="text-base font-semibold">
          {form.id ? "Editar movimiento" : "Nuevo movimiento real"}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Fecha</span>
            <select
              className={selectClass}
              value={form.entryDate}
              onChange={(event) => update({ entryDate: event.target.value })}
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {formatDayLabel(date)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Tipo</span>
            <select
              className={selectClass}
              value={form.direction}
              onChange={(event) =>
                update({
                  direction: event.target.value as "ingreso" | "egreso",
                })
              }
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Categoría</span>
            <select
              className={selectClass}
              value={form.categoryId}
              onChange={(event) => update({ categoryId: event.target.value })}
            >
              <option value="">Elegí una categoría…</option>
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Importe</span>
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => update({ amount: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Concepto</span>
            <Input
              value={form.concept}
              onChange={(event) => update({ concept: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">
              Proveedor / Descripción
            </span>
            <Input
              value={form.counterparty}
              onChange={(event) => update({ counterparty: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Cuenta</span>
            <Input
              value={form.account}
              onChange={(event) => update({ account: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Observación</span>
            <Input
              value={form.note}
              onChange={(event) => update({ note: event.target.value })}
            />
          </label>
        </div>

        {hint && hintCategory ? (
          <div
            className={cn(
              "mt-4 rounded-lg border p-3 text-sm",
              hintMismatch
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            <p>{hint.reason}</p>
            {hintMismatch ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => update({ categoryId: hintCategory.id })}
                >
                  Usar {hintCategory.name}
                </Button>
                {hint.level === "obligatoria" ? (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(event) => setOverride(event.target.checked)}
                    />
                    Guardar igual en la categoría elegida
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={pending}>
            <Plus className="size-4" />
            {form.id ? "Guardar cambios" : "Agregar movimiento"}
          </Button>
          {form.id ? (
            <Button
              variant="ghost"
              onClick={() => {
                setForm(emptyForm(form.entryDate));
                setOverride(false);
              }}
            >
              Cancelar
            </Button>
          ) : null}
          {message ? (
            <span className="text-muted-foreground text-sm">{message}</span>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">
          Movimientos de la semana ({movements.length})
        </h2>
        <div className="mt-3 space-y-4">
          {byDate.map(({ date, rows }) => (
            <div key={date}>
              <p className="text-muted-foreground px-1 text-xs font-medium uppercase">
                {formatDayLabel(date)}
              </p>
              {rows.length === 0 ? (
                <p className="text-muted-foreground px-1 py-1 text-sm">
                  Sin movimientos.
                </p>
              ) : (
                <table className="mt-1 w-full text-sm">
                  <tbody className="divide-border/60 divide-y">
                    {rows.map((movement) => {
                      const category = categoriesById.get(movement.category_id);
                      return (
                        <tr key={movement.id} className="hover:bg-muted/30">
                          <td className="px-1 py-1.5">{movement.concept}</td>
                          <td className="text-muted-foreground px-1 py-1.5">
                            {movement.counterparty ?? "—"}
                          </td>
                          <td className="px-1 py-1.5">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs",
                                category?.is_financing
                                  ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : "border-border text-muted-foreground",
                              )}
                            >
                              {category?.name ?? "—"}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-1 py-1.5 text-right tabular-nums",
                              movement.direction === "ingreso"
                                ? "text-emerald-700"
                                : "text-foreground",
                            )}
                          >
                            {movement.direction === "egreso" ? "−" : "+"}
                            {formatMoney(Number(movement.amount))}
                          </td>
                          <td className="w-20 px-1 py-1.5 text-right">
                            <button
                              type="button"
                              aria-label="Editar"
                              className="text-muted-foreground hover:text-foreground p-1"
                              onClick={() =>
                                setForm({
                                  id: movement.id,
                                  entryDate: movement.entry_date,
                                  direction: movement.direction,
                                  categoryId: movement.category_id,
                                  concept: movement.concept,
                                  counterparty: movement.counterparty ?? "",
                                  amount: String(movement.amount),
                                  account: movement.account ?? "",
                                  note: movement.note ?? "",
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
                              onClick={() => remove(movement.id)}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
