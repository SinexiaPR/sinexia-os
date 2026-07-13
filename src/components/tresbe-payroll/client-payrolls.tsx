"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Download, FileText } from "lucide-react";

import { markTresbePayrollViewed } from "@/actions/tresbe-payroll";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  TresbePayroll,
  TresbePayrollEntry,
} from "@/services/tresbe-payroll";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function TresbeClientPayrolls({
  payrolls,
  selected,
  entries,
}: {
  payrolls: TresbePayroll[];
  selected: TresbePayroll | null;
  entries: TresbePayrollEntry[];
}) {
  useEffect(() => {
    if (selected) void markTresbePayrollViewed(selected.id);
  }, [selected]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-muted-foreground text-sm">Tresbe</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Nóminas</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Resúmenes semanales enviados por Sinexia.
        </p>
      </header>

      {!payrolls.length ? (
        <SurfaceCard>
          <p className="text-muted-foreground text-sm">
            Todavía no hay nóminas enviadas disponibles.
          </p>
        </SurfaceCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {payrolls.map((payroll) => (
            <Link key={payroll.id} href={`?payroll=${payroll.id}`}>
              <SurfaceCard
                padding="md"
                className={
                  payroll.id === selected?.id ? "border-primary/50" : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {payroll.week_start} — {payroll.week_end}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {payroll.viewed_at ? "Vista" : "Nueva"}
                      {payroll.sent_at
                        ? ` · Enviada ${new Date(payroll.sent_at).toLocaleDateString("es")}`
                        : ""}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {money.format(payroll.grand_total)}
                  </p>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      )}

      {selected ? (
        <>
          <SurfaceCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase">
                  Periodo
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {selected.week_start} — {selected.week_end}
                </h2>
              </div>
              <Button asChild>
                <a
                  href={`/api/tresbe-payroll/${selected.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="size-4" /> Descargar PDF
                </a>
              </Button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Nómina en sistema"
                value={selected.total_system_pay}
              />
              <Metric label="Tips" value={selected.total_tips} />
              <Metric
                label="Cheques de servicios"
                value={selected.total_service_checks}
              />
              <Metric
                label="Total general"
                value={selected.grand_total}
                strong
              />
            </div>
            {selected.client_note ? (
              <div className="bg-muted/50 mt-6 rounded-lg p-4">
                <p className="text-xs font-medium uppercase">
                  Mensaje de Sinexia
                </p>
                <p className="mt-2 text-sm">{selected.client_note}</p>
              </div>
            ) : null}
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-center gap-2">
              <FileText className="text-muted-foreground size-4" />
              <h2 className="font-semibold">Detalle por empleado</h2>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b">
                  <tr>
                    <th className="py-2">Empleado</th>
                    <th>Horas</th>
                    <th>H. sistema</th>
                    <th>H. servicio</th>
                    <th>Sistema</th>
                    <th>Tips</th>
                    <th>Servicios</th>
                    <th>Ajustes</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2">
                        <p className="font-medium">
                          {entry.employee_name_snapshot}
                        </p>
                        <p className="text-muted-foreground">
                          {entry.area_snapshot}
                        </p>
                      </td>
                      <td>{entry.total_weekly_hours}</td>
                      <td>{entry.system_hours}</td>
                      <td>{entry.service_hours}</td>
                      <td>{money.format(entry.system_pay)}</td>
                      <td>{money.format(entry.tips)}</td>
                      <td>{money.format(entry.service_check_amount)}</td>
                      <td>{money.format(entry.other_adjustments)}</td>
                      <td className="font-medium">
                        {money.format(entry.employee_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`mt-1 ${strong ? "text-xl font-semibold" : "font-medium"}`}>
        {money.format(value)}
      </p>
    </div>
  );
}
