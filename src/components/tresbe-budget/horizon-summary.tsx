import Link from "next/link";

import { SurfaceCard } from "@/components/ui/surface-card";
import type { HorizonRow } from "@/lib/tresbe-budget/calculations";
import { formatWeekRange } from "@/lib/tresbe-budget/dates";
import { formatCell, varianceClass } from "@/lib/tresbe-budget/format";
import { cn } from "@/lib/utils";

/**
 * El "Resumen Semanal" de la planilla original quedó siempre vacío. Acá se
 * calcula sobre los mismos movimientos y presupuesto de cada semana.
 */
export function HorizonSummary({
  companyId,
  weeks,
  rows,
}: {
  companyId: string;
  weeks: number;
  rows: HorizonRow[];
}) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      incomeBudget: accumulator.incomeBudget + row.income.budget,
      incomeReal: accumulator.incomeReal + row.income.real,
      expenseBudget: accumulator.expenseBudget + row.expenses.budget,
      expenseReal: accumulator.expenseReal + row.expenses.real,
    }),
    { incomeBudget: 0, incomeReal: 0, expenseBudget: 0, expenseReal: 0 },
  );
  const netBudget = totals.incomeBudget - totals.expenseBudget;
  const netReal = totals.incomeReal - totals.expenseReal;

  return (
    <SurfaceCard padding="sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="text-base font-semibold">Resumen de {weeks} semanas</h2>
        <p className="text-muted-foreground text-xs">
          Totales operativos; la línea de reserva se muestra aparte.
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-xs">
          <thead>
            <tr className="text-muted-foreground border-b text-[11px] uppercase">
              <th className="px-2 py-2 text-left">Semana</th>
              <th className="border-l px-2 py-2 text-right">Ingresos ppto</th>
              <th className="px-2 py-2 text-right">Ingresos real</th>
              <th className="px-2 py-2 text-right">Desvío</th>
              <th className="border-l px-2 py-2 text-right">Egresos ppto</th>
              <th className="px-2 py-2 text-right">Egresos real</th>
              <th className="px-2 py-2 text-right">Desvío</th>
              <th className="border-l px-2 py-2 text-right">Flujo ppto</th>
              <th className="px-2 py-2 text-right">Flujo real</th>
              <th className="px-2 py-2 text-right">Desvío</th>
              <th className="border-l px-2 py-2 text-right">Reserva neta</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((row) => (
              <tr key={row.weekStart} className="hover:bg-muted/30">
                <td className="px-2 py-1.5">
                  <Link
                    href={`/dashboard/admin/companies/${companyId}/budget?week=${row.weekStart}`}
                    className="hover:underline"
                  >
                    <span className="font-medium">S{row.weekNumber}</span>{" "}
                    <span className="text-muted-foreground">
                      {formatWeekRange(row.weekStart)}
                    </span>
                  </Link>
                  {!row.hasBudget && !row.hasReal ? (
                    <span className="text-muted-foreground ml-2 text-[10px] uppercase">
                      sin datos
                    </span>
                  ) : null}
                </td>
                <td className="border-l px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.income.budget)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.income.real)}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums",
                    varianceClass(row.income.variance),
                  )}
                >
                  {formatCell(row.income.variance)}
                </td>
                <td className="border-l px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.expenses.budget)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.expenses.real)}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums",
                    varianceClass(row.expenses.variance),
                  )}
                >
                  {formatCell(row.expenses.variance)}
                </td>
                <td className="border-l px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.net.budget)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.net.real)}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums",
                    varianceClass(row.net.variance),
                  )}
                >
                  {formatCell(row.net.variance)}
                </td>
                <td className="border-l px-2 py-1.5 text-right tabular-nums">
                  {formatCell(row.financingNetReal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50 font-medium">
              <td className="px-2 py-2">Total del horizonte</td>
              <td className="border-l px-2 py-2 text-right tabular-nums">
                {formatCell(totals.incomeBudget)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatCell(totals.incomeReal)}
              </td>
              <td
                className={cn(
                  "px-2 py-2 text-right tabular-nums",
                  varianceClass(totals.incomeReal - totals.incomeBudget),
                )}
              >
                {formatCell(totals.incomeReal - totals.incomeBudget)}
              </td>
              <td className="border-l px-2 py-2 text-right tabular-nums">
                {formatCell(totals.expenseBudget)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatCell(totals.expenseReal)}
              </td>
              <td
                className={cn(
                  "px-2 py-2 text-right tabular-nums",
                  varianceClass(totals.expenseBudget - totals.expenseReal),
                )}
              >
                {formatCell(totals.expenseBudget - totals.expenseReal)}
              </td>
              <td className="border-l px-2 py-2 text-right tabular-nums">
                {formatCell(netBudget)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatCell(netReal)}
              </td>
              <td
                className={cn(
                  "px-2 py-2 text-right tabular-nums",
                  varianceClass(netReal - netBudget),
                )}
              >
                {formatCell(netReal - netBudget)}
              </td>
              <td className="border-l px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </SurfaceCard>
  );
}
