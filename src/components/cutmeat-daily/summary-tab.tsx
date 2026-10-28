"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { deleteVarianceLine, saveVarianceLine } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { formatDayLabel } from "@/lib/cutmeat-daily/dates";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type { DailyReportWorkspace } from "@/services/cutmeat-daily";

type VarianceRow = {
  id?: string;
  concept: string;
  amount: string;
  section: "variance" | "uncollected_deposit";
};

/**
 * Todo lo que calculations.ts produjo para el día, de solo lectura, salvo
 * la Variación Diaria: líneas libres (concepto + monto) que carga el
 * admin a mano, sin tipos fijos ni clasificación automática.
 */
export function SummaryTab({
  companyId,
  workspace,
  readOnly,
}: {
  companyId: string;
  workspace: DailyReportWorkspace;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<VarianceRow[]>(
    (workspace.varianceLines ?? []).map((line) => ({
      id: line.id,
      concept: line.concept,
      amount: String(line.amount),
      section: line.section,
    })),
  );

  const reportId = workspace.report?.id;

  const removeRow = (index: number) => {
    const row = rows[index];
    if (row.id && reportId) {
      startTransition(async () => {
        const result = await deleteVarianceLine({
          companyId,
          reportId,
          id: row.id!,
        });
        setMessage("error" in result ? result.error : null);
        router.refresh();
      });
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  const save = () => {
    if (!reportId) return;
    const toSave = rows.filter(
      (row) => row.concept.trim() && row.amount.trim(),
    );
    startTransition(async () => {
      const results = await Promise.all(
        toSave.map((row) =>
          saveVarianceLine({
            id: row.id,
            companyId,
            reportId,
            concept: row.concept.trim(),
            amount: Number(row.amount) || 0,
            section: row.section,
          }),
        ),
      );
      const errors = results.filter(
        (result): result is { error: string } => "error" in result,
      );
      setMessage(
        errors.length
          ? errors.map((e) => e.error).join(" ")
          : "Variación Diaria guardada.",
      );
      router.refresh();
    });
  };

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
              value={formatMoney(
                workspace.reconciliationControl.statementEnding,
              )}
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
              label={
                workspace.reconciliationControl.balanced
                  ? "Control"
                  : "Control -- NO CUADRA"
              }
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
        <h2 className="text-base font-semibold">
          A/P Aging Detail Recurrentes
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MetricCard
            label="Recurrentes prior to this week"
            value={formatMoney(-workspace.buckets.prior.total)}
            hint={`${workspace.buckets.prior.items.length} pendientes vencidos antes del domingo.`}
          />
          <MetricCard
            label="Recurrentes de esta semana"
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
            <MetricCard
              label="Balance Today"
              value={formatMoney(workspace.financial.balanceToday)}
            />
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
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Variación Diaria</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly || !reportId}
            onClick={() =>
              setRows((current) => [
                ...current,
                { concept: "", amount: "", section: "variance" },
              ])
            }
          >
            <Plus className="size-4" />
            Agregar línea
          </Button>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Líneas libres (concepto + monto), sin tipos fijos ni clasificación
          automática -- igual que hoy las carga Hernan en la planilla.
        </p>
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.id ?? `new-${index}`}
              className="flex items-center gap-2"
            >
              <Input
                placeholder="Concepto"
                value={row.concept}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, concept: event.target.value };
                  setRows(next);
                }}
              />
              <Input
                inputMode="decimal"
                placeholder="Monto"
                className="w-32"
                value={row.amount}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, amount: event.target.value };
                  setRows(next);
                }}
              />
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={row.section}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = {
                    ...row,
                    section: event.target.value as VarianceRow["section"],
                  };
                  setRows(next);
                }}
              >
                <option value="variance">Variación Diaria</option>
                <option value="uncollected_deposit">Depósito sin cobrar</option>
              </select>
              <button
                type="button"
                aria-label="Eliminar"
                disabled={readOnly || pending}
                className="text-muted-foreground hover:text-destructive p-1"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin líneas cargadas.
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={save} disabled={pending || readOnly || !reportId}>
            Guardar Variación Diaria
          </Button>
          {message ? (
            <span className="text-muted-foreground text-sm">{message}</span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Variación total"
            value={formatMoney(workspace.totalVariance)}
          />
          <MetricCard
            label="Balance GABRIEL"
            value={formatMoney(workspace.balanceGabriel)}
          />
          <MetricCard
            label="Balance + Not entered Sales"
            value={formatMoney(workspace.balanceWithNotEntered)}
            hint={`${workspace.notEnteredDeposits.length} depósito(s) todavía no en QuickBooks.`}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="text-base font-semibold">
          Consolidated Report -- Aging
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {workspace.vendorAging ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Aging Vendors</p>
              <p className="text-muted-foreground">
                Raw total: {formatMoney(workspace.vendorAging.rawTotal)} −
                excluidos {formatMoney(workspace.vendorAging.excludedSubtotal)}{" "}
                − Prime Meats{" "}
                {formatMoney(workspace.vendorAging.primeMeatsBalance)}
              </p>
              <p className="text-lg font-semibold">
                {formatMoney(workspace.vendorAging.consolidated)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin aging de proveedores cargado.
            </p>
          )}
          {workspace.customerAging ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Aging Customers</p>
              <p className="text-lg font-semibold">
                {formatMoney(workspace.customerAging.consolidated)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Sin aging de clientes cargado.
            </p>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}
