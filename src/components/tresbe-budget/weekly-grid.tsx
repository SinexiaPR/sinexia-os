"use client";

import { Fragment, useEffect, useState, useTransition } from "react";

import { saveBudgetCell } from "@/actions/tresbe-budget";
import { formatCell, varianceClass } from "@/lib/tresbe-budget/format";
import { formatDayLabel } from "@/lib/tresbe-budget/dates";
import type {
  CategoryRow,
  GroupRow,
  WeekView,
} from "@/lib/tresbe-budget/calculations";
import { cn } from "@/lib/utils";

function BudgetInput({
  companyId,
  categoryId,
  entryDate,
  value,
  origin,
  note,
  editable,
  onSaved,
}: {
  companyId: string;
  categoryId: string;
  entryDate: string;
  value: number;
  origin: "calculado" | "manual" | null;
  note: string | null;
  editable: boolean;
  onSaved: (message: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ? value.toFixed(2) : "");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    setDraft(value ? value.toFixed(2) : "");
  }, [value]);

  if (!editable) {
    return <span className="tabular-nums">{formatCell(value)}</span>;
  }

  const commit = () => {
    const parsed = draft.trim() === "" ? 0 : Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(value ? value.toFixed(2) : "");
      onSaved("Importe inválido.");
      return;
    }
    if (Math.abs(parsed - value) < 0.005) return;
    startTransition(async () => {
      const result = await saveBudgetCell({
        companyId,
        entryDate,
        categoryId,
        amount: Math.round(parsed * 100) / 100,
      });
      onSaved(
        "error" in result ? (result.error ?? "No se pudo guardar.") : null,
      );
    });
  };

  return (
    <input
      inputMode="decimal"
      value={draft}
      disabled={pending}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      placeholder="—"
      title={note ?? undefined}
      className={cn(
        "h-7 w-20 rounded border px-1.5 text-right text-xs tabular-nums outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]",
        origin === "manual"
          ? "border-amber-300 bg-amber-50 font-medium text-amber-900"
          : "border-input bg-transparent",
        pending && "opacity-60",
      )}
    />
  );
}

function TotalsCells({ totals }: { totals: GroupRow["totals"] }) {
  return (
    <>
      <td className="border-l px-2 py-1 text-right tabular-nums">
        {formatCell(totals.budget)}
      </td>
      <td className="px-2 py-1 text-right tabular-nums">
        {formatCell(totals.real)}
      </td>
      <td
        className={cn(
          "px-2 py-1 text-right tabular-nums",
          varianceClass(totals.variance),
        )}
      >
        {formatCell(totals.variance)}
      </td>
    </>
  );
}

function GroupTableRow({
  row,
  className,
}: {
  row: GroupRow;
  className?: string;
}) {
  return (
    <tr className={cn("bg-muted/40 font-medium", className)}>
      <th
        scope="row"
        className="bg-card sticky left-0 z-10 px-3 py-1.5 text-left"
      >
        {row.label}
      </th>
      {row.cells.map((cell) => (
        <Fragment key={`${row.key}-${cell.date}`}>
          <td className="border-l px-2 py-1.5 text-right tabular-nums">
            {formatCell(cell.budget)}
          </td>
          <td className="px-2 py-1.5 text-right tabular-nums">
            {formatCell(cell.real)}
          </td>
          <td
            className={cn(
              "px-2 py-1.5 text-right tabular-nums",
              varianceClass(cell.variance),
            )}
          >
            {formatCell(cell.variance)}
          </td>
        </Fragment>
      ))}
      <TotalsCells totals={row.totals} />
    </tr>
  );
}

function SectionRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="bg-muted/60">
      <th
        scope="row"
        colSpan={span}
        className="px-3 py-1 text-left text-[10px] font-semibold tracking-wide uppercase"
      >
        {label}
      </th>
    </tr>
  );
}

export function WeeklyGrid({
  companyId,
  week,
  editable = true,
  onMessage,
}: {
  companyId: string;
  week: WeekView;
  editable?: boolean;
  onMessage?: (message: string | null) => void;
}) {
  const notify = onMessage ?? (() => {});
  const incomeRows = week.rows.filter(
    (row) => row.category.total_group === "ingresos",
  );
  const expenseGroups: Array<{
    key: string;
    rows: CategoryRow[];
    subtotal: GroupRow;
  }> = week.expenseSubtotals.map((subtotal) => ({
    key: subtotal.key,
    subtotal,
    rows: week.rows.filter((row) => row.category.total_group === subtotal.key),
  }));

  const renderCategoryRow = (row: CategoryRow) => (
    <tr key={row.category.id} className="hover:bg-muted/30">
      <th
        scope="row"
        className="bg-card sticky left-0 z-10 px-3 py-1 text-left font-normal"
      >
        {row.category.name}
      </th>
      {row.cells.map((cell) => (
        <Fragment key={`${row.category.id}-${cell.date}`}>
          <td className="border-l px-1.5 py-1 text-right">
            <BudgetInput
              companyId={companyId}
              categoryId={row.category.id}
              entryDate={cell.date}
              value={cell.budget}
              origin={cell.origin}
              note={cell.note}
              editable={editable}
              onSaved={notify}
            />
          </td>
          <td className="px-2 py-1 text-right tabular-nums">
            {formatCell(cell.real)}
          </td>
          <td
            className={cn(
              "px-2 py-1 text-right tabular-nums",
              varianceClass(cell.variance),
            )}
          >
            {formatCell(cell.variance)}
          </td>
        </Fragment>
      ))}
      <TotalsCells totals={row.totals} />
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-xs">
        <thead>
          <tr className="text-muted-foreground text-[11px] tracking-wide uppercase">
            <th className="bg-card sticky left-0 z-10 px-3 py-2 text-left">
              Categoría
            </th>
            {week.dates.map((date) => (
              <th
                key={date}
                colSpan={3}
                className="border-l px-2 py-2 text-center"
              >
                {formatDayLabel(date)}
              </th>
            ))}
            <th colSpan={3} className="border-l px-2 py-2 text-center">
              Semana
            </th>
          </tr>
          <tr className="text-muted-foreground border-b text-[10px]">
            <th className="bg-card sticky left-0 z-10 px-3 pb-2 text-left" />
            {[...week.dates, "total"].map((key) => (
              <Fragment key={key}>
                <th className="border-l px-2 pb-2 text-right font-normal">
                  Ppto
                </th>
                <th className="px-2 pb-2 text-right font-normal">Real</th>
                <th className="px-2 pb-2 text-right font-normal">Desv.</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border/60 divide-y">
          {incomeRows.map(renderCategoryRow)}
          <GroupTableRow row={week.income} />
          {expenseGroups.map((group) => (
            <Fragment key={group.key}>
              {group.rows.map(renderCategoryRow)}
              {group.rows.length > 1 ? (
                <GroupTableRow row={group.subtotal} />
              ) : null}
            </Fragment>
          ))}
          <GroupTableRow row={week.expenses} />
          <GroupTableRow row={week.net} className="bg-muted/70" />
          {week.intercompanyRows.length ? (
            <>
              <SectionRow
                label="Intercompany — movimientos entre LLC"
                span={week.dates.length * 3 + 4}
              />
              {week.intercompanyRows.map(renderCategoryRow)}
            </>
          ) : null}
          {week.financingRows.length ? (
            <>
              <SectionRow
                label="Financiamiento — línea de crédito"
                span={week.dates.length * 3 + 4}
              />
              {week.financingRows.map(renderCategoryRow)}
            </>
          ) : null}
        </tbody>
      </table>
      <p className="text-muted-foreground mt-3 text-xs">
        Desvío favorable en verde: en ingresos es Real − Presupuesto; en
        egresos, Presupuesto − Real. Las celdas ámbar del presupuesto fueron
        editadas a mano y no se pisan al regenerar la semana.
      </p>
    </div>
  );
}

export function FinancingBlock({ week }: { week: WeekView }) {
  const hasIntercompany =
    week.intercompany.received !== 0 || week.intercompany.delivered !== 0;
  const hasFinancing =
    week.financing.drawdown !== 0 || week.financing.repayment !== 0;
  if (!hasIntercompany && !hasFinancing) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {hasIntercompany ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <p className="text-sm font-medium text-sky-900">
            Intercompany (fuera de los totales operativos)
          </p>
          <p className="mt-1 text-xs text-sky-900/80">
            Transferencias entre las LLC del grupo: no son venta ni gasto, pero
            sí mueven la caja antes del financiamiento.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Recibido</p>
              <p className="font-medium tabular-nums">
                {formatCell(week.intercompany.received)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Entregado</p>
              <p className="font-medium tabular-nums">
                {formatCell(week.intercompany.delivered)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Neto</p>
              <p className="font-medium tabular-nums">
                {formatCell(week.intercompany.netReal)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {hasFinancing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-medium text-amber-900">
            Línea de crédito (fuera de los totales operativos)
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            Los barridos del banco no son ingresos ni gastos; solo entran en el
            saldo real para conciliar contra el banco.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Utilización</p>
              <p className="font-medium tabular-nums">
                {formatCell(week.financing.drawdown)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Repago</p>
              <p className="font-medium tabular-nums">
                {formatCell(week.financing.repayment)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Saldo de la línea</p>
              <p className="font-medium tabular-nums">
                {formatCell(week.financing.creditLineClosing)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
