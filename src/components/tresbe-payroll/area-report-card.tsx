"use client";

import { useMemo } from "react";

import { SurfaceCard } from "@/components/ui/surface-card";
import {
  CALLE_CERRA_AREA,
  computeAreaHoursTips,
  computeAreaPay,
  computeServiceChecksTotal,
  reconcileTresbeAreaReport,
} from "@/lib/tresbe-payroll/area-report";
import type {
  TresbeEmployee,
  TresbePayroll,
  TresbePayrollDailyEntry,
  TresbePayrollEntry,
} from "@/services/tresbe-payroll";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function TresbeAreaReportCard({
  payroll,
  entries,
  dailyEntries,
  employees,
}: {
  payroll: TresbePayroll;
  entries: TresbePayrollEntry[];
  dailyEntries: TresbePayrollDailyEntry[];
  employees: Pick<TresbeEmployee, "id" | "area">[];
}) {
  const areaHoursTips = useMemo(
    () => computeAreaHoursTips(dailyEntries),
    [dailyEntries],
  );
  const areaPay = useMemo(
    () => computeAreaPay(entries, employees),
    [entries, employees],
  );
  const reconciliation = useMemo(
    () => reconcileTresbeAreaReport(payroll, areaPay, areaHoursTips),
    [payroll, areaPay, areaHoursTips],
  );
  const serviceChecksTotal = useMemo(
    () => computeServiceChecksTotal(entries),
    [entries],
  );

  const tipsTresbe = round2(
    areaHoursTips
      .filter((a) => a.area === "BOH" || a.area === "FOH")
      .reduce((sum, a) => sum + a.tips, 0),
  );
  const tipsCafeConCe =
    areaHoursTips.find((a) => a.area === "CAFE CON CE")?.tips ?? 0;
  const tipsCalleCerra =
    areaHoursTips.find((a) => a.area === CALLE_CERRA_AREA)?.tips ?? 0;
  const otherTipAreas = areaHoursTips.filter(
    (a) => !["BOH", "FOH", "CAFE CON CE", CALLE_CERRA_AREA].includes(a.area),
  );

  return (
    <SurfaceCard>
      <h2 className="font-semibold">Desglose por área</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Para revisar antes de imprimir -- no aparece en el PDF.
      </p>

      {!reconciliation.ok ? (
        <div className="mt-3 space-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {reconciliation.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="text-sm font-semibold">
          Horas pagadas por área (Sistema + Servicios, sin propina)
        </h3>
        <table className="mt-2 w-full max-w-md text-left text-sm">
          <tbody>
            {areaPay.map((row) => (
              <tr key={row.area} className="border-b last:border-0">
                <td className="py-1.5">{row.area}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {money.format(row.paidNoTip)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right tabular-nums">
                {money.format(
                  round2(areaPay.reduce((sum, a) => sum + a.paidNoTip, 0)),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Propinas</h3>
        <table className="mt-2 w-full max-w-md text-left text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-1.5">Tips Tresbe (BOH + FOH)</td>
              <td className="py-1.5 text-right tabular-nums">
                {money.format(tipsTresbe)}
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5">Tips Café con Ce</td>
              <td className="py-1.5 text-right tabular-nums">
                {money.format(tipsCafeConCe)}
              </td>
            </tr>
            <tr className="border-b">
              <td className="py-1.5">Tips Café con Ce Calle Cerra</td>
              <td className="py-1.5 text-right tabular-nums">
                {money.format(tipsCalleCerra)}
              </td>
            </tr>
            {otherTipAreas.map((row) => (
              <tr key={row.area} className="border-b">
                <td className="py-1.5">Tips {row.area}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {money.format(row.tips)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right tabular-nums">
                {money.format(
                  round2(areaHoursTips.reduce((sum, a) => sum + a.tips, 0)),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground mt-5 border-t pt-4 text-sm">
        Total pagado por cheques de servicios esta semana:{" "}
        <strong className="text-foreground">
          {money.format(serviceChecksTotal)}
        </strong>{" "}
        (ya incluido en el total general, no se suma aparte).
      </p>
    </SurfaceCard>
  );
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
