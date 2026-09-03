"use client";

import { useState, useTransition } from "react";

import { saveCashControl } from "@/actions/tresbe-budget";
import { messageFrom } from "@/lib/tresbe-budget/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { WeekView } from "@/lib/tresbe-budget/calculations";
import { formatDayLabel } from "@/lib/tresbe-budget/dates";
import { formatCell, formatMoney } from "@/lib/tresbe-budget/format";
import { cn } from "@/lib/utils";

const dailyCashRows: Array<{
  label: string;
  hint?: string;
  pick: (day: WeekView["cash"]["cashAccount"]["days"][number]) => number;
}> = [
  { label: "Saldo Inicial Cash", pick: (day) => day.opening },
  { label: "+ Ingresos Operativos Cash", pick: (day) => day.income },
  { label: "- Egresos Operativos Cash", pick: (day) => day.expense },
  {
    label: "+ Movimiento Neto Intercompany",
    hint: "No aparece en la planilla; cuenta para el saldo si algún día hay intercompany en efectivo",
    pick: (day) => day.intercompanyNet,
  },
  {
    label: "+ Financiamiento Externo Neto Cash",
    pick: (day) => day.externoNet,
  },
  {
    label: "+ Transferencias Banco → Cash",
    hint: "Retiro Banco a Cash",
    pick: (day) => day.transferIn,
  },
  {
    label: "- Depósitos Cash → Banco",
    hint: "Depósito Cash a Banco",
    pick: (day) => day.transferOut,
  },
  { label: "= Saldo Final Cash Teórico", pick: (day) => day.closing },
];

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function Line({
  label,
  budget,
  real,
  hint,
  strong,
}: {
  label: string;
  budget: number | null;
  real: number | null;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_auto] items-baseline gap-4 py-1.5 text-sm",
        strong && "border-t font-medium",
      )}
    >
      <div>
        <span>{label}</span>
        {hint ? (
          <span className="text-muted-foreground block text-xs">{hint}</span>
        ) : null}
      </div>
      <span className="w-28 text-right tabular-nums">
        {formatMoney(budget)}
      </span>
      <span className="w-28 text-right tabular-nums">{formatMoney(real)}</span>
    </div>
  );
}

export function CashControlCard({
  companyId,
  weekStart,
  week,
}: {
  companyId: string;
  weekStart: string;
  week: WeekView;
}) {
  const [opening, setOpening] = useState(String(week.cash.opening ?? 0));
  const [actual, setActual] = useState(
    week.cash.actual == null ? "" : String(week.cash.actual),
  );
  const [cashOpening, setCashOpening] = useState(
    String(week.cash.cashAccount.opening ?? 0),
  );
  const [cashActual, setCashActual] = useState(
    week.cash.cashAccount.actual == null
      ? ""
      : String(week.cash.cashAccount.actual),
  );
  const [minimum, setMinimum] = useState(
    week.cash.minimum == null ? "" : String(week.cash.minimum),
  );
  const [notes, setNotes] = useState(week.cash.notes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const openingValue = parseAmount(opening) ?? 0;
    const actualValue = parseAmount(actual);
    const cashOpeningValue = parseAmount(cashOpening) ?? 0;
    const cashActualValue = parseAmount(cashActual);
    const minimumValue = parseAmount(minimum);
    if (actual.trim() !== "" && actualValue == null) {
      setMessage("El saldo bancario real no es un número válido.");
      return;
    }
    if (cashActual.trim() !== "" && cashActualValue == null) {
      setMessage("El cash real contado no es un número válido.");
      return;
    }
    if (minimum.trim() !== "" && minimumValue == null) {
      setMessage("La caja mínima objetivo no es un número válido.");
      return;
    }
    startTransition(async () => {
      const result = await saveCashControl({
        companyId,
        weekStart,
        openingBankBalance: openingValue,
        actualBankBalance: actualValue,
        openingCashBalance: cashOpeningValue,
        actualCashBalance: cashActualValue,
        minimumCashTarget: minimumValue,
        notes: notes.trim() || null,
      });
      setMessage(messageFrom(result, "Control de caja guardado."));
    });
  };

  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Control de Caja</h2>
        <div className="text-muted-foreground grid grid-cols-[auto_auto] gap-4 text-xs uppercase">
          <span className="w-28 text-right">Presupuesto</span>
          <span className="w-28 text-right">Real</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs">
            Saldo Banco Inicial
          </span>
          <Input
            inputMode="decimal"
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs">
            Saldo Banco Real (cierre)
          </span>
          <Input
            inputMode="decimal"
            placeholder="Sin cargar"
            value={actual}
            onChange={(event) => setActual(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs">
            Caja Mínima Objetivo
          </span>
          <Input
            inputMode="decimal"
            placeholder="Sin cargar"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs">
            Saldo Cash Inicial
          </span>
          <Input
            inputMode="decimal"
            value={cashOpening}
            onChange={(event) => setCashOpening(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground text-xs">
            Cash Real Contado (cierre)
          </span>
          <Input
            inputMode="decimal"
            placeholder="Sin cargar"
            value={cashActual}
            onChange={(event) => setCashActual(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5">
        <Line
          label="Saldo Banco Inicial"
          budget={week.cash.opening}
          real={week.cash.opening}
        />
        <Line
          label="+ Flujo Neto Operativo BANCO"
          hint="Solo Banco Popular; el efectivo se rastrea aparte"
          budget={week.net.totals.budget}
          real={week.cash.bankOperatingReal}
        />
        <Line
          label="+ Movimiento Neto Intercompany"
          hint="Solo Banco Popular; transferencias entre las LLC"
          budget={week.intercompany.netBudget}
          real={week.intercompany.netReal}
        />
        <Line
          label="+ Financiamiento Externo Neto"
          hint="Solo Banco Popular; Aporte + Préstamo − Repago de Dueño"
          budget={week.financingExterno.netBudget}
          real={week.financingExterno.netReal}
        />
        <Line
          label="+/− Transferencia Interna"
          hint="Depósito Cash a Banco − Retiro Banco a Cash; no lleva presupuesto"
          budget={null}
          real={week.cash.transferNetReal}
        />
        <Line
          label="= Saldo antes de Financiamiento"
          budget={week.cash.beforeFinancingBudget}
          real={week.cash.beforeFinancingReal}
          strong
        />
        <Line
          label="+ Utilización Línea de Crédito"
          budget={0}
          real={week.financing.drawdown}
        />
        <Line
          label="− Repago Línea de Crédito"
          budget={0}
          real={week.financing.repayment}
        />
        <Line
          label="= Saldo Final Banco Teórico"
          budget={week.cash.theoreticalBudget}
          real={week.cash.theoreticalReal}
          strong
        />
        <Line
          label="Saldo Banco Real"
          hint="Campo manual"
          budget={null}
          real={week.cash.actual}
        />
        <Line
          label="Diferencia a Conciliar"
          hint="Saldo Banco Real − Saldo Final Teórico"
          budget={null}
          real={week.cash.differenceToReconcile}
        />
        <Line
          label="Excedente / Necesidad"
          hint="Saldo Final Teórico − Caja Mínima Objetivo"
          budget={week.cash.surplusBudget}
          real={week.cash.surplusReal}
          strong
        />
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">CONTROL DIARIO CASH / CAJA</h3>
        <p className="text-muted-foreground text-xs">
          Efectivo físico, aparte del banco. No lleva presupuesto ni línea de
          crédito.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-xs uppercase">
                <th className="py-1 pr-2 text-left font-normal">Concepto</th>
                {week.cash.cashAccount.days.map((day) => (
                  <th
                    key={day.date}
                    className="px-2 py-1 text-right font-normal whitespace-nowrap"
                  >
                    {formatDayLabel(day.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {dailyCashRows.map((row) => (
                <tr key={row.label}>
                  <td className="py-1 pr-2">
                    <span>{row.label}</span>
                    {row.hint ? (
                      <span className="text-muted-foreground block text-xs">
                        {row.hint}
                      </span>
                    ) : null}
                  </td>
                  {week.cash.cashAccount.days.map((day) => (
                    <td
                      key={day.date}
                      className={cn(
                        "px-2 py-1 text-right tabular-nums",
                        row.label.startsWith("=") && "font-medium",
                      )}
                    >
                      {formatCell(row.pick(day))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <Line
            label="Cash Real Contado"
            hint="Campo manual"
            budget={null}
            real={week.cash.cashAccount.actual}
          />
          <Line
            label="Diferencia Cash a Conciliar"
            hint="Cash Real Contado − Saldo Final Teórico"
            budget={null}
            real={week.cash.cashAccount.differenceToReconcile}
          />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">LIQUIDEZ TOTAL AL CIERRE</h3>
        <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] gap-4 text-sm">
          <span />
          <span className="text-muted-foreground w-24 text-right text-xs uppercase">
            Banco
          </span>
          <span className="text-muted-foreground w-24 text-right text-xs uppercase">
            Cash
          </span>
          <span className="text-muted-foreground w-24 text-right text-xs uppercase">
            Total Liquidez
          </span>
          <span className="py-1">Saldo Final Teórico</span>
          <span className="w-24 text-right tabular-nums">
            {formatMoney(week.cash.theoreticalReal)}
          </span>
          <span className="w-24 text-right tabular-nums">
            {formatMoney(week.cash.cashAccount.theoreticalReal)}
          </span>
          <span className="w-24 text-right font-medium tabular-nums">
            {formatMoney(
              week.cash.theoreticalReal + week.cash.cashAccount.theoreticalReal,
            )}
          </span>
          <span className="py-1">Saldo Real / Contado</span>
          <span className="w-24 text-right tabular-nums">
            {formatMoney(week.cash.actual)}
          </span>
          <span className="w-24 text-right tabular-nums">
            {formatMoney(week.cash.cashAccount.actual)}
          </span>
          <span className="w-24 text-right font-medium tabular-nums">
            {week.cash.actual == null || week.cash.cashAccount.actual == null
              ? formatMoney(null)
              : formatMoney(week.cash.actual + week.cash.cashAccount.actual)}
          </span>
          <span className="border-t py-1 font-medium">Diferencia Total</span>
          <span className="w-24 border-t text-right tabular-nums">
            {formatMoney(week.cash.differenceToReconcile)}
          </span>
          <span className="w-24 border-t text-right tabular-nums">
            {formatMoney(week.cash.cashAccount.differenceToReconcile)}
          </span>
          <span className="w-24 border-t text-right font-medium tabular-nums">
            {week.cash.differenceToReconcile == null ||
            week.cash.cashAccount.differenceToReconcile == null
              ? formatMoney(null)
              : formatMoney(
                  week.cash.differenceToReconcile +
                    week.cash.cashAccount.differenceToReconcile,
                )}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Línea de Crédito</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo inicial</span>
              <span className="tabular-nums">
                {formatMoney(week.financing.creditLineOpening)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                + Utilización − Repago
              </span>
              <span className="tabular-nums">
                {formatMoney(week.financing.netReal)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <span>Saldo final</span>
              <span className="tabular-nums">
                {formatMoney(week.financing.creditLineClosing)}
              </span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Control Intercompany</h3>
          {week.intercompany.counterparties.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Sin contrapartes cargadas.
            </p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs uppercase">
                  <th className="py-1 text-left">LLC</th>
                  <th className="py-1 text-right">Inicial</th>
                  <th className="py-1 text-right">Recibido</th>
                  <th className="py-1 text-right">Entregado</th>
                  <th className="py-1 text-right">Final</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {week.intercompany.counterparties.map((row) => (
                  <tr key={row.id}>
                    <td className="py-1">{row.name}</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(row.opening)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(row.received)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatMoney(row.delivered)}
                    </td>
                    <td className="py-1 text-right font-medium tabular-nums">
                      {formatMoney(row.closing)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <label className="mt-4 block space-y-1 text-sm">
        <span className="text-muted-foreground text-xs">
          Notas de la semana
        </span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar control de caja"}
        </Button>
        {message ? (
          <span className="text-muted-foreground text-sm">{message}</span>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
