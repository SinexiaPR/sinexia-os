import { notFound } from "next/navigation";

import { PrintButton } from "@/components/tresbe-budget/print-button";
import { WeeklyGrid } from "@/components/tresbe-budget/weekly-grid";
import { requireAdmin } from "@/lib/auth/session";
import { formatWeekRange } from "@/lib/tresbe-budget/dates";
import { formatMoney } from "@/lib/tresbe-budget/format";
import {
  getBudgetWeekWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-budget";

export const dynamic = "force-dynamic";

export default async function TresbeBudgetPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const { week } = await searchParams;
  const company = await resolveTresbeCompany(companyId);
  if (!company) notFound();
  const workspace = await getBudgetWeekWorkspace(company.id, week);
  const view = workspace.week;
  const cashRows: Array<[string, string, string]> = [
    [
      "Saldo Banco Inicial",
      formatMoney(view.cash.opening),
      formatMoney(view.cash.opening),
    ],
    [
      "+ Ingresos operativos",
      formatMoney(view.income.totals.budget),
      formatMoney(view.income.totals.real),
    ],
    [
      "− Egresos operativos",
      formatMoney(view.expenses.totals.budget),
      formatMoney(view.expenses.totals.real),
    ],
    ["± Línea de reserva", formatMoney(0), formatMoney(view.financing.netReal)],
    [
      "Saldo Final Teórico",
      formatMoney(view.cash.theoreticalBudget),
      formatMoney(view.cash.theoreticalReal),
    ],
    ["Saldo Banco Real", "—", formatMoney(view.cash.actual)],
    [
      "Diferencia a Conciliar",
      "—",
      formatMoney(view.cash.differenceToReconcile),
    ],
    [
      "Excedente / Necesidad",
      formatMoney(view.cash.surplusBudget),
      formatMoney(view.cash.surplusReal),
    ],
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-6 print:p-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs uppercase">
            {company.name} · Seguimiento diario
          </p>
          <h1 className="text-2xl font-semibold">
            {workspace.weekNumber ? `Semana ${workspace.weekNumber} · ` : ""}
            {formatWeekRange(workspace.weekStart)}
          </h1>
        </div>
        <PrintButton />
      </div>

      <WeeklyGrid companyId={company.id} week={view} editable={false} />

      <div>
        <h2 className="text-base font-semibold">Control de Caja</h2>
        <table className="mt-2 w-full max-w-lg text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs uppercase">
              <th className="py-1 text-left">Concepto</th>
              <th className="py-1 text-right">Presupuesto</th>
              <th className="py-1 text-right">Real</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {cashRows.map(([label, budget, real]) => (
              <tr key={label}>
                <td className="py-1">{label}</td>
                <td className="py-1 text-right tabular-nums">{budget}</td>
                <td className="py-1 text-right tabular-nums">{real}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.cash.notes ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {view.cash.notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
