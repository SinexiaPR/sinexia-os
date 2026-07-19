"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { saveLeaveAccrualSettings } from "@/actions/leave-accrual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const sortHeader = (key: SortKey, label: string) => (
    <th
      className="hover:text-foreground cursor-pointer px-3 py-3 select-none"
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      <SurfaceCard padding="sm">
        <h2 className="font-semibold">Configuración</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Límite de balance de enfermedad por compañía (por ley, 15 días = 120
          horas por defecto).
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {companySettings.map((setting) => (
            <SickCapForm key={setting.companyId} setting={setting} />
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <div className="grid gap-3 border-b pb-5 md:grid-cols-3">
          <Input
            placeholder="Buscar empleado"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="bg-background h-9 rounded-md border px-3 text-sm"
            value={sourceSystem}
            onChange={(event) => setSourceSystem(event.target.value)}
          >
            <option value="">Ambos sistemas</option>
            <option value="sibarita">Sibarita</option>
            <option value="tresbe">Tresbe</option>
          </select>
          <Button asChild variant="outline">
            <a href="/api/leave-accrual/export">Descargar Excel</a>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="text-muted-foreground border-b text-xs uppercase">
              <tr>
                {sortHeader("employeeName", "Empleado")}
                <th className="px-3 py-3">Sistema</th>
                {sortHeader("hiringDate", "Fecha de contratación")}
                {sortHeader("yearsOfService", "Años de servicio")}
                <th className="px-3 py-3">Categoría actual</th>
                <th className="px-3 py-3">Tasa mensual vacaciones</th>
                <th className="px-3 py-3">Próximo cambio de categoría</th>
                {sortHeader("currentMonthHours", "Horas del mes actual")}
                {sortHeader("vacationBalanceHours", "Balance vacaciones")}
                {sortHeader("sickBalanceHours", "Balance enfermedad")}
                {sortHeader("lastPayrollProcessedAt", "Última nómina procesada")}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={`${row.sourceSystem}-${row.employeeId}`}
                  className="hover:bg-muted/50 border-b last:border-0"
                >
                  <td className="px-3 py-3 font-medium">
                    <Link
                      href={`/dashboard/admin/leave-accrual/${row.sourceSystem}/${row.employeeId}`}
                      className="hover:underline"
                    >
                      {row.employeeName}
                    </Link>
                  </td>
                  <td className="capitalize">{row.sourceSystem}</td>
                  <td>{formatDate(row.hiringDate)}</td>
                  <td>{row.yearsOfService ?? "—"}</td>
                  <td>{row.currentTier ? TIER_LABELS[row.currentTier] : "—"}</td>
                  <td>
                    {row.monthlyVacationRateHours != null
                      ? `${row.monthlyVacationRateHours} h/mes`
                      : "—"}
                  </td>
                  <td>
                    {row.nextTierChangeDate ? formatDate(row.nextTierChangeDate) : "N/A"}
                  </td>
                  <td>
                    {row.currentMonthHours.toFixed(2)}
                    {row.currentMonthQualifies ? (
                      <span className="ml-1 text-xs text-emerald-700">
                        Califica
                      </span>
                    ) : (
                      <span className="text-muted-foreground ml-1 text-xs">
                        No califica
                      </span>
                    )}
                  </td>
                  <td>{row.vacationBalanceHours.toFixed(2)} h</td>
                  <td>{row.sickBalanceHours.toFixed(2)} h</td>
                  <td>
                    {row.lastPayrollProcessedAt
                      ? formatDate(row.lastPayrollProcessedAt)
                      : "—"}
                  </td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td
                    colSpan={11}
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
    </div>
  );
}

function SickCapForm({
  setting,
}: {
  setting: { companyId: string; companyName: string; sickBalanceCapHours: number };
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
