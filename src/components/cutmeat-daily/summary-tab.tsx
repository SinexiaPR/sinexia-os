import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { formatDayLabel } from "@/lib/cutmeat-daily/dates";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type { DailyReportWorkspace } from "@/services/cutmeat-daily";

/**
 * Todo lo que calculations.ts produjo para el día, de solo lectura. Cada
 * número indica de dónde sale, para poder auditarlo contra el PDF.
 */
export function SummaryTab({ workspace }: { workspace: DailyReportWorkspace }) {
  if (!workspace.settings) return null;

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <h2 className="text-base font-semibold">Control de conciliación</h2>
        <p className="text-muted-foreground text-sm">
          Statement ending + uncleared checks + uncleared deposits − Register
          (debe dar $0.00).
        </p>
        {workspace.reconciliationControl ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Statement ending"
              value={formatMoney(workspace.reconciliationControl.statementEnding)}
            />
            <MetricCard
              label="Uncleared (checks + deposits)"
              value={formatMoney(
                workspace.reconciliationControl.unclearedChecksTotal +
                  workspace.reconciliationControl.unclearedDepositsTotal,
              )}
            />
            <MetricCard
              label="Register"
              value={formatMoney(workspace.reconciliationControl.register)}
            />
            <MetricCard
              label={workspace.reconciliationControl.balanced ? "Control" : "Control -- NO CUADRA"}
              value={formatMoney(workspace.reconciliationControl.control)}
              className={
                workspace.reconciliationControl.balanced
                  ? undefined
                  : "border-red-300 bg-red-50"
              }
            />
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            Todavía no se cargó la conciliación de este día.
          </p>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-base font-semibold">A/P Aging Detail Recurrentes</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Recurrentes prior to this week"
            value={formatMoney(-workspace.buckets.prior.total)}
            hint={`${workspace.buckets.prior.items.length} pendientes vencidos antes del domingo.`}
          />
          <MetricCard
            label="Recurrentes for this week"
            value={formatMoney(-workspace.buckets.thisWeek.total)}
            hint={`${workspace.buckets.thisWeek.items.length} pendientes de esta semana.`}
          />
        </div>
        {workspace.weeklyPayments ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Balance after Weekly Payments = Register (
            {formatMoney(workspace.weeklyPayments.register)}) − recurrentes
            prior ({formatMoney(workspace.weeklyPayments.recurrentesPrior)}) −
            recurrentes this week (
            {formatMoney(workspace.weeklyPayments.recurrentesThisWeek)}) ={" "}
            <strong>
              {formatMoney(workspace.weeklyPayments.balanceAfterWeeklyPayments)}
            </strong>
          </p>
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">
            Cargá la conciliación para calcular el Balance after Weekly
            Payments.
          </p>
        )}
      </SurfaceCard>

      {workspace.financial ? (
        <SurfaceCard>
          <h2 className="text-base font-semibold">Financial Report</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Balance Today" value={formatMoney(workspace.financial.balanceToday)} />
            <MetricCard
              label={`7-day (${formatDayLabel(workspace.financial.day7.date)})`}
              value={formatMoney(workspace.financial.day7.balance)}
              hint={`+ ingresos de la semana (${formatMoney(workspace.financial.day7.income)})`}
            />
            <MetricCard
              label={`14-day (${formatDayLabel(workspace.financial.day14.date)})`}
              value={formatMoney(workspace.financial.day14.balance)}
              hint={`+ ${formatMoney(workspace.financial.day14.income)} − recurrentes (${formatMoney(workspace.financial.day14.recurrentes)})`}
            />
            <MetricCard
              label={`21-day (${formatDayLabel(workspace.financial.day21.date)})`}
              value={formatMoney(workspace.financial.day21.balance)}
              hint={`+ ${formatMoney(workspace.financial.day21.income)} − recurrentes (${formatMoney(workspace.financial.day21.recurrentes)})`}
            />
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <h2 className="text-base font-semibold">Variación Diaria</h2>
        {workspace.variance.items.length ? (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs uppercase">
                <th className="px-1 py-1">Concepto</th>
                <th className="px-1 py-1 text-right">Recurrente</th>
                <th className="px-1 py-1 text-right">Real</th>
                <th className="px-1 py-1 text-right">Variación</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {workspace.variance.items.map((item) => (
                <tr key={item.concept}>
                  <td className="px-1 py-1.5">{item.concept}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {formatMoney(item.recurringAmount)}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {formatMoney(item.actualAmount)}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums">
                    {formatMoney(item.variance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground mt-3 text-sm">
            Sin recurrentes pagados con monto real informado todavía.
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Variación total" value={formatMoney(workspace.variance.totalVariance)} />
          <MetricCard label="Balance GABRIEL" value={formatMoney(workspace.balanceGabriel)} />
          <MetricCard
            label="Balance + Not entered Sales"
            value={formatMoney(workspace.balanceWithNotEntered)}
            hint={`${workspace.notEnteredDeposits.length} depósito(s) todavía no en QuickBooks.`}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-base font-semibold">Consolidated Report -- Aging</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {workspace.vendorAging ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Aging Vendors</p>
              <p className="text-muted-foreground">
                Raw total: {formatMoney(workspace.vendorAging.rawTotal)} − excluidos{" "}
                {formatMoney(workspace.vendorAging.excludedSubtotal)} − Prime Meats{" "}
                {formatMoney(workspace.vendorAging.primeMeatsBalance)}
              </p>
              <p className="text-lg font-semibold">
                {formatMoney(workspace.vendorAging.consolidated)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin aging de proveedores cargado.</p>
          )}
          {workspace.customerAging ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Aging Customers</p>
              <p className="text-lg font-semibold">
                {formatMoney(workspace.customerAging.consolidated)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin aging de clientes cargado.</p>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
