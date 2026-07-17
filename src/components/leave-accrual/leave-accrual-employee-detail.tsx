import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  LeaveAccrualEmployeeDetail as LeaveAccrualEmployeeDetailData,
  LeaveAccrualMonthlyHistoryRow,
} from "@/services/leave-accrual";
import type { TenureTier } from "@/lib/leave-accrual/calculations";

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const monthName = new Intl.DateTimeFormat("es", { month: "long" });

const TIER_LABELS: Record<TenureTier, string> = {
  under_1: "Menos de 1 año",
  one_to_five: "1 a 5 años",
  five_to_fifteen: "5 a 15 años",
  over_fifteen: "15 años o más",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return shortDate.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatMonth(year: number, month: number) {
  const label = monthName.format(new Date(Date.UTC(year, month - 1, 1)));
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${year}`;
}

function SummaryItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

export function LeaveAccrualEmployeeDetail({
  detail,
}: {
  detail: LeaveAccrualEmployeeDetailData;
}) {
  const { tenure } = detail;

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <h2 className="font-semibold">Estatus actual</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Hiring Day" value={formatDate(detail.hiringDate)} />
          <SummaryItem
            label="Antigüedad actual"
            value={tenure ? `${tenure.yearsOfService} años` : "—"}
          />
          <SummaryItem
            label="Categoría actual"
            value={tenure ? TIER_LABELS[tenure.tier] : "—"}
          />
          <SummaryItem
            label="Próxima fecha de cambio de categoría"
            value={tenure?.nextTierChangeDate ? formatDate(tenure.nextTierChangeDate) : "N/A"}
          />
          <SummaryItem
            label="Tasa mensual actual de vacaciones"
            value={tenure ? `${tenure.monthlyVacationRateHours} h/mes` : "—"}
          />
          <SummaryItem
            label="Balance de vacaciones"
            value={`${detail.vacationBalanceHours.toFixed(2)} h`}
          />
          <SummaryItem
            label="Balance de enfermedad"
            value={`${detail.sickBalanceHours.toFixed(2)} h`}
          />
          <SummaryItem
            label="Horas computables del mes"
            value={
              <>
                {detail.currentMonthHours.toFixed(2)} h{" "}
                {detail.currentMonthQualifies ? (
                  <span className="text-xs text-emerald-700">(Elegible — 130h+)</span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    (No elegible — requiere 130h)
                  </span>
                )}
              </>
            }
          />
        </div>
        <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem
            label="Vacaciones acumuladas (vida)"
            value={`${detail.vacationAccruedLifetimeHours.toFixed(2)} h`}
          />
          <SummaryItem
            label="Vacaciones usadas (vida)"
            value={`${detail.vacationUsedLifetimeHours.toFixed(2)} h`}
          />
          <SummaryItem
            label="Enfermedad acumulada (vida)"
            value={`${detail.sickAccruedLifetimeHours.toFixed(2)} h`}
          />
          <SummaryItem
            label="Enfermedad usada (vida)"
            value={`${detail.sickUsedLifetimeHours.toFixed(2)} h`}
          />
        </div>
      </SurfaceCard>

      {detail.openingBalance ? (
        <SurfaceCard padding="sm">
          <h2 className="font-semibold">Balance inicial importado</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Balance de partida cargado antes de que este módulo entrara en
            operación, vigente a partir de{" "}
            {formatMonth(detail.openingBalance.asOfYear, detail.openingBalance.asOfMonth)}.
            {detail.openingBalance.note ? ` ${detail.openingBalance.note}` : ""}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SummaryItem
              label="Vacaciones al importar"
              value={`${detail.openingBalance.vacationHours.toFixed(2)} h`}
            />
            <SummaryItem
              label="Enfermedad al importar"
              value={`${detail.openingBalance.sickHours.toFixed(2)} h`}
            />
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard padding="sm">
        <h2 className="font-semibold">Historial mensual de acumulaciones y usos</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="text-muted-foreground border-b text-xs uppercase">
              <tr>
                <th className="px-3 py-3">Mes</th>
                <th className="px-3 py-3">Horas computables</th>
                <th className="px-3 py-3">Elegible (130h)</th>
                <th className="px-3 py-3">Categoría usada</th>
                <th className="px-3 py-3">Vacaciones acum.</th>
                <th className="px-3 py-3">Enfermedad acum.</th>
                <th className="px-3 py-3">Vacaciones usadas</th>
                <th className="px-3 py-3">Enfermedad usada</th>
                <th className="px-3 py-3">Balance vacaciones</th>
                <th className="px-3 py-3">Balance enfermedad</th>
                <th className="px-3 py-3">Hiring Day usado</th>
                <th className="px-3 py-3">Nóminas origen</th>
                <th className="px-3 py-3">Versión</th>
              </tr>
            </thead>
            <tbody>
              {detail.monthlyHistory.map((row) => (
                <HistoryRow key={`${row.periodYear}-${row.periodMonth}`} row={row} />
              ))}
              {!detail.monthlyHistory.length ? (
                <tr>
                  <td
                    colSpan={13}
                    className="text-muted-foreground px-3 py-6 text-center"
                  >
                    Sin historial mensual todavía — se generará cuando se
                    procese la primera nómina de este empleado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
}

function HistoryRow({ row }: { row: LeaveAccrualMonthlyHistoryRow }) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-3 font-medium">{formatMonth(row.periodYear, row.periodMonth)}</td>
      <td className="px-3 py-3">{row.qualifyingHours.toFixed(2)} h</td>
      <td className="px-3 py-3">
        {row.qualifies ? (
          <span className="text-xs text-emerald-700">Sí</span>
        ) : (
          <span className="text-muted-foreground text-xs">No</span>
        )}
      </td>
      <td className="px-3 py-3">{TIER_LABELS[row.tenureTier]}</td>
      <td className="px-3 py-3">{row.vacationAccruedHours.toFixed(2)} h</td>
      <td className="px-3 py-3">{row.sickAccruedHours.toFixed(2)} h</td>
      <td className="px-3 py-3">{row.vacationUsedHours.toFixed(2)} h</td>
      <td className="px-3 py-3">{row.sickUsedHours.toFixed(2)} h</td>
      <td className="px-3 py-3">{row.vacationBalanceAfterHours.toFixed(2)} h</td>
      <td className="px-3 py-3">{row.sickBalanceAfterHours.toFixed(2)} h</td>
      <td className="px-3 py-3">{formatDate(row.hiringDateUsed)}</td>
      <td className="px-3 py-3">{row.sourcePayrollIds.length || "—"}</td>
      <td className="px-3 py-3">v{row.calculationVersion}</td>
    </tr>
  );
}
