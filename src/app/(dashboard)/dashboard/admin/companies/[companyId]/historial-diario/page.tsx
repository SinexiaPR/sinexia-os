import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatDayLabel } from "@/lib/cutmeat-daily/dates";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import { getDailyHistory } from "@/services/cutmeat-daily-history";
import { requireCutMeatAccess } from "@/services/cutmeat-recurrentes";

export const dynamic = "force-dynamic";

/**
 * Historial diario (backfill): solo lectura para todos, incluido el
 * admin -- Parte B es "backfill, solo datos; no recalcular", así que no
 * hay edición acá. Las correcciones se hacen por migración, como el resto
 * del backfill.
 */
export default async function CutMeatDailyHistoryPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const { company } = await requireCutMeatAccess(companyId);
  const rows = await getDailyHistory(company.id);

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/dashboard/admin/companies/${company.id}`}>
            <ArrowLeft className="size-4" />
            Volver a {company.name}
          </Link>
        </Button>
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {company.name} · Historial diario
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Conciliación día por día
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Backfill desde los PDF originales (Drive) -- solo lectura, sin
            recálculo. Gabriel[día] debería coincidir siempre con el Balance
            after Weekly Payments del día anterior cargado; la columna
            &quot;Diferencia&quot; lo marca cuando no coincide.
          </p>
        </div>
      </header>

      <SurfaceCard padding="sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs uppercase">
                <th className="px-2 py-1">Fecha</th>
                <th className="px-2 py-1 text-right">Statement</th>
                <th className="px-2 py-1 text-right">Register</th>
                <th className="px-2 py-1 text-right">Balance after Weekly (B)</th>
                <th className="px-2 py-1 text-right">Balance GABRIEL</th>
                <th className="px-2 py-1 text-right">Diferencia</th>
                <th className="px-2 py-1 text-right">Aging Vendors</th>
                <th className="px-2 py-1 text-right">Aging Customers</th>
                <th className="px-2 py-1">Fuente</th>
              </tr>
            </thead>
            <tbody className="divide-border/60 divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatDayLabel(row.reportDate)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.statementBalance)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.registerBalance)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.balanceAfterWeekly)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.balanceGabriel)}</td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${
                      row.diffFromPriorBalance != null && Math.abs(row.diffFromPriorBalance) > 0.004
                        ? "font-medium text-red-700"
                        : "text-muted-foreground"
                    }`}
                  >
                    {row.diffFromPriorBalance == null ? "—" : formatMoney(row.diffFromPriorBalance)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.agingVendorsTotal)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(row.agingCustomersTotal)}</td>
                  <td className="px-2 py-1.5 text-muted-foreground text-xs">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">
              Sin historial diario cargado todavía.
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
