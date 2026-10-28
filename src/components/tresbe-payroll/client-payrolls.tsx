"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ChevronDown, Download, Wallet } from "lucide-react";

import { markTresbePayrollViewed } from "@/actions/tresbe-payroll";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { paginate } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type {
  TresbePayroll,
  TresbePayrollEntry,
} from "@/services/tresbe-payroll";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function sentLabel(payroll: TresbePayroll) {
  return payroll.sent_at
    ? `Enviada ${new Date(payroll.sent_at).toLocaleDateString("es")}`
    : null;
}

export function TresbeClientPayrolls({
  payrolls,
  selected,
  entries,
}: {
  payrolls: TresbePayroll[];
  selected: TresbePayroll | null;
  entries: TresbePayrollEntry[];
}) {
  const [historyPage, setHistoryPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const history = paginate(payrolls, historyPage, 8);

  useEffect(() => {
    if (selected) void markTresbePayrollViewed(selected.id);
  }, [selected]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Nóminas</h1>
        <p className="text-muted-foreground text-sm">
          Resúmenes semanales enviados por Sinexia.
        </p>
      </header>

      {!payrolls.length ? (
        <SurfaceCard padding="sm" className="p-0">
          <EmptyState
            icon={Wallet}
            title="Todavía no hay nóminas"
            description="Cuando Sinexia le envíe la nómina de una semana, la verá aquí."
          />
        </SurfaceCard>
      ) : null}

      {selected ? (
        <>
          <SurfaceCard padding="md" className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Semana
                </p>
                <h2 className="text-lg font-semibold tabular-nums">
                  {selected.week_start} — {selected.week_end}
                </h2>
                {sentLabel(selected) ? (
                  <p className="text-muted-foreground text-sm">
                    {sentLabel(selected)}
                  </p>
                ) : null}
              </div>
              <Button asChild className="h-11 w-full sm:w-auto">
                <a
                  href={`/api/tresbe-payroll/${selected.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="size-4" /> Descargar PDF
                </a>
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            </dl>

            {selected.client_note ? (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Mensaje de Sinexia
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {selected.client_note}
                </p>
              </div>
            ) : null}
          </SurfaceCard>

          <SurfaceCard padding="sm" className="p-0">
            <h2 className="px-4 pt-4 text-base font-semibold tracking-tight">
              Detalle por empleado
            </h2>
            <Table containerClassName="mt-2" density="compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Más datos</span>
                  </TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead numeric className="hidden sm:table-cell">
                    Horas
                  </TableHead>
                  <TableHead numeric className="hidden md:table-cell">
                    Sistema
                  </TableHead>
                  <TableHead numeric className="hidden md:table-cell">
                    Tips
                  </TableHead>
                  <TableHead numeric>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const isOpen = expanded.has(entry.id);
                  const detailId = `nomina-${entry.id}`;
                  return (
                    <Fragment key={entry.id}>
                      <TableRow>
                        <TableCell className="py-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            aria-label={`${isOpen ? "Ocultar" : "Ver"} detalle de ${entry.employee_name_snapshot}`}
                            onClick={() => toggle(entry.id)}
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {entry.employee_name_snapshot}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {entry.area_snapshot}
                          </p>
                        </TableCell>
                        <TableCell numeric className="hidden sm:table-cell">
                          {entry.total_weekly_hours}
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {money.format(entry.system_pay)}
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {money.format(entry.tips)}
                        </TableCell>
                        <TableCell numeric className="font-semibold">
                          {money.format(entry.employee_total)}
                        </TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow id={detailId} className="bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={5}>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                              <Detail
                                label="Horas totales"
                                value={String(entry.total_weekly_hours)}
                                className="sm:hidden"
                              />
                              <Detail
                                label="Horas de sistema"
                                value={String(entry.system_hours)}
                              />
                              <Detail
                                label="Horas de servicio"
                                value={String(entry.service_hours)}
                              />
                              <Detail
                                label="Sistema"
                                value={money.format(entry.system_pay)}
                                className="md:hidden"
                              />
                              <Detail
                                label="Tips"
                                value={money.format(entry.tips)}
                                className="md:hidden"
                              />
                              <Detail
                                label="Servicios"
                                value={money.format(entry.service_check_amount)}
                              />
                              <Detail
                                label="Ajustes"
                                value={money.format(entry.other_adjustments)}
                              />
                            </dl>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </SurfaceCard>

          <div className="bg-background/95 sticky bottom-16 z-20 -mx-4 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:bottom-0">
            <p className="flex flex-wrap items-baseline justify-between gap-2 pr-16 text-sm">
              <span className="text-muted-foreground">
                Total general · {entries.length}{" "}
                {entries.length === 1 ? "empleado" : "empleados"}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {money.format(selected.grand_total)}
              </span>
            </p>
          </div>
        </>
      ) : null}

      {payrolls.length > 1 || (payrolls.length === 1 && !selected) ? (
        <section aria-labelledby="semanas-titulo" className="space-y-3">
          <h2
            id="semanas-titulo"
            className="text-base font-semibold tracking-tight"
          >
            Semanas anteriores
          </h2>
          <SurfaceCard padding="sm" className="p-0">
            <ul className="divide-border/70 divide-y">
              {history.items.map((payroll) => (
                <li key={payroll.id}>
                  <Link
                    href={`?payroll=${payroll.id}`}
                    aria-current={
                      payroll.id === selected?.id ? "true" : undefined
                    }
                    className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 px-4 py-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm tabular-nums",
                          payroll.id === selected?.id && "font-semibold",
                        )}
                      >
                        {payroll.week_start} — {payroll.week_end}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {sentLabel(payroll)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge
                        tone={payroll.viewed_at ? "neutral" : "info"}
                      >
                        {payroll.viewed_at ? "Vista" : "Nueva"}
                      </StatusBadge>
                      <span className="text-sm font-semibold tabular-nums">
                        {money.format(payroll.grand_total)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <PaginationBar view={history} onPageChange={setHistoryPage} />
          </SurfaceCard>
        </section>
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
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "mt-1 tabular-nums",
          strong ? "text-xl font-semibold" : "font-medium",
        )}
      >
        {money.format(value)}
      </dd>
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
