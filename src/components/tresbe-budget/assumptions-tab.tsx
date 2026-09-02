"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import {
  deleteRecurringDebit,
  deleteVendorSchedule,
  saveBudgetSettings,
  saveRecurringDebit,
  saveSalesPattern,
  saveVendorSchedule,
} from "@/actions/tresbe-budget";
import { messageFrom } from "@/lib/tresbe-budget/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { weekdayName } from "@/lib/tresbe-budget/dates";
import { formatMoney, formatPercent } from "@/lib/tresbe-budget/format";
import type {
  BudgetAssumptions,
  BudgetCategory,
} from "@/services/tresbe-budget";

const selectClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]";
const weekdays = [1, 2, 3, 4, 5, 6, 7];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground block text-xs">{label}</span>
      {children}
      {hint ? (
        <span className="text-muted-foreground block text-[11px]">{hint}</span>
      ) : null}
    </label>
  );
}

export function AssumptionsTab({
  companyId,
  assumptions,
  categories,
}: {
  companyId: string;
  assumptions: BudgetAssumptions;
  categories: BudgetCategory[];
}) {
  const expenseCategories = categories.filter(
    (category) => category.kind === "egreso",
  );
  const [settings, setSettings] = useState(() => ({
    weekOneStart: assumptions.settings.week_one_start,
    forecastWeeks: String(assumptions.settings.forecast_weeks),
    processorFeeRate: String(
      Number(assumptions.settings.processor_fee_rate) * 100,
    ),
    loanHoldbackRate: String(
      Number(assumptions.settings.loan_holdback_rate) * 100,
    ),
    cardSettlementLagDays: String(
      assumptions.settings.card_settlement_lag_days,
    ),
    payrollAmount: String(assumptions.settings.payroll_amount),
    payrollWeekday: String(assumptions.settings.payroll_weekday),
    relatedCashOutLabel: assumptions.settings.related_cash_out_label ?? "",
    relatedCashOutAmount: String(assumptions.settings.related_cash_out_amount),
    relatedCashOutEnabled: assumptions.settings.related_cash_out_enabled,
    payrollTaxRate: String(Number(assumptions.settings.payroll_tax_rate) * 100),
    payrollTaxOffsetDays: String(assumptions.settings.payroll_tax_offset_days),
  }));
  const [pattern, setPattern] = useState(() =>
    weekdays.map((weekday) => {
      const row = assumptions.salesPattern.find(
        (item) => item.weekday === weekday,
      );
      return {
        weekday,
        grossSales: String(row?.gross_sales ?? 0),
        cardShare: String(Number(row?.card_share ?? 0) * 100),
      };
    }),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saveSettings = () => {
    startTransition(async () => {
      const result = await saveBudgetSettings({
        companyId,
        weekOneStart: settings.weekOneStart,
        forecastWeeks: Number(settings.forecastWeeks),
        processorFeeRate: Number(settings.processorFeeRate) / 100,
        loanHoldbackRate: Number(settings.loanHoldbackRate) / 100,
        cardSettlementLagDays: Number(settings.cardSettlementLagDays),
        payrollAmount: Number(settings.payrollAmount),
        payrollWeekday: Number(settings.payrollWeekday),
        relatedCashOutLabel: settings.relatedCashOutLabel.trim() || null,
        relatedCashOutAmount: Number(settings.relatedCashOutAmount),
        relatedCashOutEnabled: settings.relatedCashOutEnabled,
        payrollTaxRate: Number(settings.payrollTaxRate) / 100,
        payrollTaxOffsetDays: Number(settings.payrollTaxOffsetDays),
      });
      setMessage(messageFrom(result, "Supuestos guardados."));
    });
  };

  const savePattern = () => {
    startTransition(async () => {
      const result = await saveSalesPattern({
        companyId,
        rows: pattern.map((row) => ({
          weekday: row.weekday,
          grossSales: Number(row.grossSales),
          cardShare: Number(row.cardShare) / 100,
        })),
      });
      setMessage(messageFrom(result, "Patrón de ventas guardado."));
    });
  };

  return (
    <div className="space-y-6">
      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      <SurfaceCard>
        <h2 className="text-base font-semibold">Supuestos generales</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          De acá sale el presupuesto de cada semana. Cambiar un valor no altera
          las semanas ya generadas hasta que se vuelvan a generar.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Semana 1 del horizonte (lunes)">
            <Input
              type="date"
              value={settings.weekOneStart}
              onChange={(event) =>
                setSettings({ ...settings, weekOneStart: event.target.value })
              }
            />
          </Field>
          <Field label="Semanas del horizonte">
            <Input
              inputMode="numeric"
              value={settings.forecastWeeks}
              onChange={(event) =>
                setSettings({ ...settings, forecastWeeks: event.target.value })
              }
            />
          </Field>
          <Field label="Comisión del procesador (%)">
            <Input
              inputMode="decimal"
              value={settings.processorFeeRate}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  processorFeeRate: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Retención de préstamo (%)">
            <Input
              inputMode="decimal"
              value={settings.loanHoldbackRate}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  loanHoldbackRate: event.target.value,
                })
              }
            />
          </Field>
          <Field
            label="Lag de acreditación de tarjeta (días)"
            hint="Días entre la venta y el depósito disponible"
          >
            <Input
              inputMode="numeric"
              value={settings.cardSettlementLagDays}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  cardSettlementLagDays: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Nómina semanal">
            <Input
              inputMode="decimal"
              value={settings.payrollAmount}
              onChange={(event) =>
                setSettings({ ...settings, payrollAmount: event.target.value })
              }
            />
          </Field>
          <Field label="Día de pago de nómina">
            <select
              className={selectClass}
              value={settings.payrollWeekday}
              onChange={(event) =>
                setSettings({ ...settings, payrollWeekday: event.target.value })
              }
            >
              {weekdays.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekdayName(weekday)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payroll tax (% de la nómina)">
            <Input
              inputMode="decimal"
              value={settings.payrollTaxRate}
              onChange={(event) =>
                setSettings({ ...settings, payrollTaxRate: event.target.value })
              }
            />
          </Field>
          <Field
            label="Payroll tax: días después de la nómina"
            hint="1 = el día siguiente al pago"
          >
            <Input
              inputMode="numeric"
              value={settings.payrollTaxOffsetDays}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  payrollTaxOffsetDays: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Cash out de entidad relacionada (etiqueta)">
            <Input
              value={settings.relatedCashOutLabel}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  relatedCashOutLabel: event.target.value,
                })
              }
            />
          </Field>
          <Field label="Cash out de entidad relacionada (importe)">
            <Input
              inputMode="decimal"
              value={settings.relatedCashOutAmount}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  relatedCashOutAmount: event.target.value,
                })
              }
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={settings.relatedCashOutEnabled}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  relatedCashOutEnabled: event.target.checked,
                })
              }
            />
            <span>Sumarlo a la nómina presupuestada</span>
          </label>
        </div>
        <Button className="mt-4" onClick={saveSettings} disabled={pending}>
          Guardar supuestos
        </Button>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-base font-semibold">Patrón de ventas por día</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          El efectivo se presupuesta el mismo día; la tarjeta,{" "}
          {settings.cardSettlementLagDays} días después y neta de comisión y
          retención.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-xs uppercase">
                <th className="px-2 py-2 text-left">Día</th>
                <th className="px-2 py-2 text-right">Venta bruta</th>
                <th className="px-2 py-2 text-right">% tarjeta</th>
                <th className="px-2 py-2 text-right">Tarjeta</th>
                <th className="px-2 py-2 text-right">Efectivo</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {pattern.map((row, index) => {
                const gross = Number(row.grossSales) || 0;
                const share = (Number(row.cardShare) || 0) / 100;
                return (
                  <tr key={row.weekday}>
                    <td className="px-2 py-1.5 capitalize">
                      {weekdayName(row.weekday)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        inputMode="decimal"
                        className="h-8 w-28 text-right"
                        value={row.grossSales}
                        onChange={(event) =>
                          setPattern(
                            pattern.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, grossSales: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        inputMode="decimal"
                        className="h-8 w-20 text-right"
                        value={row.cardShare}
                        onChange={(event) =>
                          setPattern(
                            pattern.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, cardShare: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="text-muted-foreground px-2 py-1.5 text-right tabular-nums">
                      {formatMoney(gross * share)}
                    </td>
                    <td className="text-muted-foreground px-2 py-1.5 text-right tabular-nums">
                      {formatMoney(gross * (1 - share))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button className="mt-4" onClick={savePattern} disabled={pending}>
          Guardar patrón
        </Button>
      </SurfaceCard>

      <RecurringDebits
        companyId={companyId}
        categories={expenseCategories}
        rows={assumptions.recurringDebits}
        onMessage={setMessage}
      />

      <VendorSchedule
        companyId={companyId}
        categories={expenseCategories}
        rows={assumptions.vendorSchedule}
        onMessage={setMessage}
      />

      <p className="text-muted-foreground text-xs">
        Comisión vigente{" "}
        {formatPercent(Number(settings.processorFeeRate) / 100)}
        {" · "}
        retención {formatPercent(Number(settings.loanHoldbackRate) / 100)}
        {" · "}
        payroll tax {formatPercent(Number(settings.payrollTaxRate) / 100)}.
      </p>
    </div>
  );
}

function RecurringDebits({
  companyId,
  categories,
  rows,
  onMessage,
}: {
  companyId: string;
  categories: BudgetCategory[];
  rows: BudgetAssumptions["recurringDebits"];
  onMessage: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    concept: "",
    amount: "",
    categoryId:
      categories.find((category) => category.code === "debitos_bancarios")
        ?.id ??
      categories[0]?.id ??
      "",
    weekday: "1",
  });

  const persist = (
    row: BudgetAssumptions["recurringDebits"][number],
    patch: Partial<{ amount: number; isActive: boolean; weekday: number }>,
  ) => {
    startTransition(async () => {
      const result = await saveRecurringDebit({
        id: row.id,
        companyId,
        concept: row.concept,
        classification: row.classification,
        categoryId: row.category_id,
        amount: patch.amount ?? Number(row.amount),
        frequency: row.frequency,
        weekday: patch.weekday ?? row.weekday,
        dayOfMonth: row.day_of_month,
        weekendShift: row.weekend_shift,
        confidence: row.confidence,
        isActive: patch.isActive ?? row.is_active,
        note: row.note,
      });
      onMessage(messageFrom(result, "Débito actualizado."));
    });
  };

  return (
    <SurfaceCard padding="sm">
      <h2 className="px-1 text-base font-semibold">
        Débitos fijos y recurrentes
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs uppercase">
              <th className="px-2 py-2 text-left">Concepto</th>
              <th className="px-2 py-2 text-left">Frecuencia</th>
              <th className="px-2 py-2 text-left">Día</th>
              <th className="px-2 py-2 text-right">Importe</th>
              <th className="px-2 py-2 text-left">Confianza</th>
              <th className="px-2 py-2 text-center">Activo</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-1.5">
                  {row.concept}
                  {row.note ? (
                    <span className="text-muted-foreground block text-xs">
                      {row.note}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 capitalize">{row.frequency}</td>
                <td className="px-2 py-1.5 capitalize">
                  {row.frequency === "mensual"
                    ? `día ${row.day_of_month}`
                    : weekdayName(row.weekday ?? 1)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Input
                    inputMode="decimal"
                    className="h-8 w-28 text-right"
                    defaultValue={String(row.amount)}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (
                        Number.isFinite(value) &&
                        value !== Number(row.amount)
                      ) {
                        persist(row, { amount: value });
                      }
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 capitalize">{row.confidence}</td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    disabled={pending}
                    onChange={(event) =>
                      persist(row, { isActive: event.target.checked })
                    }
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    aria-label="Eliminar"
                    className="text-muted-foreground hover:text-destructive p-1"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteRecurringDebit({
                          companyId,
                          id: row.id,
                        });
                        onMessage(messageFrom(result, "Débito eliminado."));
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 px-1">
        <Input
          className="w-56"
          placeholder="Nuevo concepto"
          value={draft.concept}
          onChange={(event) =>
            setDraft({ ...draft, concept: event.target.value })
          }
        />
        <Input
          className="w-28"
          inputMode="decimal"
          placeholder="Importe"
          value={draft.amount}
          onChange={(event) =>
            setDraft({ ...draft, amount: event.target.value })
          }
        />
        <select
          className={`${selectClass} w-36`}
          value={draft.weekday}
          onChange={(event) =>
            setDraft({ ...draft, weekday: event.target.value })
          }
        >
          {weekdays.map((weekday) => (
            <option key={weekday} value={weekday}>
              {weekdayName(weekday)}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={pending || !draft.concept.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await saveRecurringDebit({
                companyId,
                concept: draft.concept.trim(),
                classification: null,
                categoryId: draft.categoryId,
                amount: Number(draft.amount) || 0,
                frequency: "semanal",
                weekday: Number(draft.weekday),
                dayOfMonth: null,
                weekendShift: "ninguno",
                confidence: "alta",
                isActive: true,
                note: null,
              });
              if (!("error" in result))
                setDraft({ ...draft, concept: "", amount: "" });
              onMessage(messageFrom(result, "Débito agregado."));
            })
          }
        >
          Agregar débito
        </Button>
      </div>
    </SurfaceCard>
  );
}

function VendorSchedule({
  companyId,
  categories,
  rows,
  onMessage,
}: {
  companyId: string;
  categories: BudgetCategory[];
  rows: BudgetAssumptions["vendorSchedule"];
  onMessage: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const defaultCategory =
    categories.find((category) => category.code === "proveedores")?.id ??
    categories[0]?.id ??
    "";
  const [draft, setDraft] = useState({
    vendorName: "",
    amount: "",
    weekday: "1",
    categoryId: defaultCategory,
    vendorType: "proveedor_activo" as
      "proveedor_activo" | "recurrente_al_dia" | "compra_mercaderia_cash",
  });

  return (
    <SurfaceCard padding="sm">
      <h2 className="px-1 text-base font-semibold">
        Calendario de proveedores
      </h2>
      <p className="text-muted-foreground mt-1 px-1 text-sm">
        Qué se paga cada día de la semana. La planilla original lo repetía igual
        las 13 semanas.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs uppercase">
              <th className="px-2 py-2 text-left">Proveedor</th>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="px-2 py-2 text-left">Categoría</th>
              <th className="px-2 py-2 text-left">Día</th>
              <th className="px-2 py-2 text-right">Importe</th>
              <th className="px-2 py-2 text-center">Activo</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-2 py-3">
                  Todavía no hay proveedores cargados: sin ellos, el presupuesto
                  generado no incluye compras ni recurrentes.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-2 py-1.5">{row.vendor_name}</td>
                <td className="px-2 py-1.5">
                  {row.vendor_type.replace(/_/g, " ")}
                </td>
                <td className="px-2 py-1.5">
                  {categories.find((item) => item.id === row.category_id)
                    ?.name ?? "—"}
                </td>
                <td className="px-2 py-1.5 capitalize">
                  {weekdayName(row.weekday)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Input
                    inputMode="decimal"
                    className="h-8 w-28 text-right"
                    defaultValue={String(row.amount)}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (
                        !Number.isFinite(value) ||
                        value === Number(row.amount)
                      ) {
                        return;
                      }
                      startTransition(async () => {
                        const result = await saveVendorSchedule({
                          id: row.id,
                          companyId,
                          vendorName: row.vendor_name,
                          vendorType: row.vendor_type,
                          categoryId: row.category_id,
                          weekday: row.weekday,
                          amount: value,
                          isActive: row.is_active,
                          note: row.note,
                        });
                        onMessage(
                          messageFrom(result, "Proveedor actualizado."),
                        );
                      });
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    disabled={pending}
                    onChange={(event) =>
                      startTransition(async () => {
                        const result = await saveVendorSchedule({
                          id: row.id,
                          companyId,
                          vendorName: row.vendor_name,
                          vendorType: row.vendor_type,
                          categoryId: row.category_id,
                          weekday: row.weekday,
                          amount: Number(row.amount),
                          isActive: event.target.checked,
                          note: row.note,
                        });
                        onMessage(
                          messageFrom(result, "Proveedor actualizado."),
                        );
                      })
                    }
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    aria-label="Eliminar"
                    className="text-muted-foreground hover:text-destructive p-1"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteVendorSchedule({
                          companyId,
                          id: row.id,
                        });
                        onMessage(messageFrom(result, "Proveedor eliminado."));
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 px-1">
        <Input
          className="w-52"
          placeholder="Nuevo proveedor"
          value={draft.vendorName}
          onChange={(event) =>
            setDraft({ ...draft, vendorName: event.target.value })
          }
        />
        <select
          className={`${selectClass} w-52`}
          value={draft.vendorType}
          onChange={(event) =>
            setDraft({
              ...draft,
              vendorType: event.target.value as typeof draft.vendorType,
            })
          }
        >
          <option value="proveedor_activo">Proveedor activo</option>
          <option value="recurrente_al_dia">Recurrente al día</option>
          <option value="compra_mercaderia_cash">Compra mercadería cash</option>
        </select>
        <select
          className={`${selectClass} w-48`}
          value={draft.categoryId}
          onChange={(event) =>
            setDraft({ ...draft, categoryId: event.target.value })
          }
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} w-36`}
          value={draft.weekday}
          onChange={(event) =>
            setDraft({ ...draft, weekday: event.target.value })
          }
        >
          {weekdays.map((weekday) => (
            <option key={weekday} value={weekday}>
              {weekdayName(weekday)}
            </option>
          ))}
        </select>
        <Input
          className="w-28"
          inputMode="decimal"
          placeholder="Importe"
          value={draft.amount}
          onChange={(event) =>
            setDraft({ ...draft, amount: event.target.value })
          }
        />
        <Button
          variant="outline"
          disabled={pending || !draft.vendorName.trim() || !draft.categoryId}
          onClick={() =>
            startTransition(async () => {
              const result = await saveVendorSchedule({
                companyId,
                vendorName: draft.vendorName.trim(),
                vendorType: draft.vendorType,
                categoryId: draft.categoryId,
                weekday: Number(draft.weekday),
                amount: Number(draft.amount) || 0,
                isActive: true,
                note: null,
              });
              if (!("error" in result)) {
                setDraft({ ...draft, vendorName: "", amount: "" });
              }
              onMessage(messageFrom(result, "Proveedor agregado."));
            })
          }
        >
          Agregar proveedor
        </Button>
      </div>
    </SurfaceCard>
  );
}
