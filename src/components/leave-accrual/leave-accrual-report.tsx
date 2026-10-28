"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, Search } from "lucide-react";

import { saveLeaveAccrualSettings } from "@/actions/leave-accrual";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { TenureTier } from "@/lib/leave-accrual/calculations";
import type { LeaveAccrualReportRow } from "@/services/leave-accrual";

const shortDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const TIER_LABELS: Record<TenureTier, string> = {
  under_1: "Menos de 1 año",
  one_to_five: "1 a 5 años",
  five_to_fifteen: "5 a 15 años",
  over_fifteen: "15 años o más",
};

type SortKey =
  | "employeeName"
  | "hiringDate"
  | "yearsOfService"
  | "currentMonthHours"
  | "vacationBalanceHours"
  | "sickBalanceHours"
  | "lastPayrollProcessedAt";

function formatDate(value: string | null) {
  if (!value) return "—";
  return shortDate.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export function LeaveAccrualReport({
  rows,
  companySettings,
}: {
  rows: LeaveAccrualReportRow[];
  companySettings: Array<{
    companyId: string;
    companyName: string;
    sickBalanceCapHours: number;
  }>;
}) {
  const [search, setSearch] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("employeeName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (sourceSystem && row.sourceSystem !== sourceSystem) return false;
      if (
        search &&
        !row.employeeName.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      if (typeof left === "number" && typeof right === "number")
        return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [rows, search, sourceSystem, sortKey, sortDirection]);

  const missingHiring = rows.filter((row) => !row.hiringDate);
  const systems = Array.from(new Set(rows.map((row) => row.sourceSystem)));

  const toggleRow = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sortHeader = (
    key: SortKey,
    label: string,
    className = "",
    align: "left" | "right" = "left",
  ) => (
    <th
      scope="col"
      aria-sort={
        sortKey === key
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`px-2 py-2.5 font-medium ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="hover:text-foreground focus-visible:ring-ring inline-flex min-h-8 items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        {label}
        <span aria-hidden>
          {sortKey === key ? (sortDirection === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      {missingHiring.length ? (
        <div
          role="status"
          className="border-warning/30 bg-warning-soft text-warning flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">
              {missingHiring.length}{" "}
              {missingHiring.length === 1 ? "empleado" : "empleados"} sin fecha
              de contratación.
            </strong>{" "}
            Sin ella no se puede calcular la categoría ni la tasa mensual de
            vacaciones. Agrégala desde Empleados y tarifas.
          </p>
        </div>
      ) : null}

      <SurfaceCard padding="sm" className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search
              aria-hidden
              className="text-muted-foreground absolute top-3 left-3 size-4"
            />
            <Input
              type="search"
              placeholder="Buscar empleado"
              aria-label="Buscar empleado"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {systems.length > 1 ? (
            <select
              aria-label="Sistema"
              className="bg-background h-10 rounded-md border px-3 text-sm"
              value={sourceSystem}
              onChange={(event) => setSourceSystem(event.target.value)}
            >
              <option value="">Ambos sistemas</option>
              <option value="sibarita">Sibarita</option>
              <option value="tresbe">Tresbe</option>
            </select>
          ) : null}
          <Button asChild variant="outline" className="h-10">
            <a href="/api/leave-accrual/export">Descargar Excel</a>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th scope="col" className="w-10 px-2 py-2.5">
                  <span className="sr-only">Detalle</span>
                </th>
                {sortHeader("employeeName", "Empleado")}
                <th
                  scope="col"
                  className="hidden px-2 py-2.5 font-medium md:table-cell"
                >
                  Categoría actual
                </th>
                {sortHeader("vacationBalanceHours", "Vacaciones", "", "right")}
                {sortHeader("sickBalanceHours", "Enfermedad", "", "right")}
                {sortHeader(
                  "lastPayrollProcessedAt",
                  "Última nómina",
                  "hidden md:table-cell",
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = `${row.sourceSystem}-${row.employeeId}`;
                const isOpen = expanded.has(key);
                const detailId = `detalle-${key}`;
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-muted/40 border-b last:border-0">
                      <td className="px-2 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          aria-label={`${isOpen ? "Ocultar" : "Ver"} detalle de ${row.employeeName}`}
                          onClick={() => toggleRow(key)}
                        >
                          <ChevronDown
                            className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </Button>
                      </td>
                      <td className="px-2 py-1.5 font-medium">
                        <Link
                          href={`/dashboard/admin/leave-accrual/${row.sourceSystem}/${row.employeeId}`}
                          className="hover:underline"
                        >
                          {row.employeeName}
                        </Link>
                      </td>
                      <td className="hidden px-2 py-1.5 md:table-cell">
                        {row.currentTier ? (
                          TIER_LABELS[row.currentTier]
                        ) : (
                          <StatusBadge tone="warning" dot={false}>
                            Sin fecha de contratación
                          </StatusBadge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.vacationBalanceHours.toFixed(2)} h
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.sickBalanceHours.toFixed(2)} h
                      </td>
                      <td className="hidden px-2 py-1.5 md:table-cell">
                        {formatDate(row.lastPayrollProcessedAt)}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr id={detailId} className="bg-muted/30 border-b">
                        <td />
                        <td colSpan={5} className="px-2 py-3">
                          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Sistema
                              </dt>
                              <dd className="capitalize">{row.sourceSystem}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Fecha de contratación
                              </dt>
                              <dd>{formatDate(row.hiringDate)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Años de servicio
                              </dt>
                              <dd>{row.yearsOfService ?? "—"}</dd>
                            </div>
                            <div className="md:hidden">
                              <dt className="text-muted-foreground text-xs">
                                Categoría actual
                              </dt>
                              <dd>
                                {row.currentTier
                                  ? TIER_LABELS[row.currentTier]
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Tasa mensual de vacaciones
                              </dt>
                              <dd>
                                {row.monthlyVacationRateHours != null
                                  ? `${row.monthlyVacationRateHours} h/mes`
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Próximo cambio de categoría
                              </dt>
                              <dd>
                                {row.nextTierChangeDate
                                  ? formatDate(row.nextTierChangeDate)
                                  : "N/A"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Horas del mes actual
                              </dt>
                              <dd className="tabular-nums">
                                {row.currentMonthHours.toFixed(2)}{" "}
                                <StatusBadge
                                  tone={
                                    row.currentMonthQualifies
                                      ? "success"
                                      : "neutral"
                                  }
                                  dot={false}
                                >
                                  {row.currentMonthQualifies
                                    ? "Califica"
                                    : "No califica"}
                                </StatusBadge>
                              </dd>
                            </div>
                            <div className="md:hidden">
                              <dt className="text-muted-foreground text-xs">
                                Última nómina procesada
                              </dt>
                              <dd>{formatDate(row.lastPayrollProcessedAt)}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!visible.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-3 py-6 text-center"
                  >
                    No hay empleados que coincidan con el filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm" className="p-0">
        <Accordion type="single" collapsible>
          <AccordionItem value="limite">
            <AccordionTrigger>
              <span className="flex-1">Límite de balance de enfermedad</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground text-sm">
                Límite por compañía (por ley, 15 días = 120 horas por defecto).
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                {companySettings.map((setting) => (
                  <SickCapForm key={setting.companyId} setting={setting} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SurfaceCard>
    </div>
  );
}

function SickCapForm({
  setting,
}: {
  setting: {
    companyId: string;
    companyName: string;
    sickBalanceCapHours: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const sickBalanceCapHours = Number(data.get("sickBalanceCapHours"));
        startTransition(async () => {
          setMessage(null);
          const result = await saveLeaveAccrualSettings({
            companyId: setting.companyId,
            sickBalanceCapHours,
          });
          setMessage(result.error ?? "Guardado.");
        });
      }}
    >
      <label className="text-sm">
        {setting.companyName}
        <Input
          name="sickBalanceCapHours"
          type="number"
          min="1"
          step="0.5"
          defaultValue={setting.sickBalanceCapHours}
          className="mt-1 w-32"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Guardar
      </Button>
      {message ? (
        <span className="text-muted-foreground text-xs">{message}</span>
      ) : null}
    </form>
  );
}
