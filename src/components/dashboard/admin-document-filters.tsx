"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { FilterPanel } from "@/components/ui/filter-panel";
import { ADMIN_DOCUMENT_TYPE_FILTERS } from "@/lib/documents/upload-metadata";
import {
  DOCUMENT_PRIORITY_LABELS,
  DOCUMENT_TYPE_LABELS,
  labelFor,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  type Company,
} from "@/types";
import type { AdminDocumentFiltersValue } from "@/services/documents";

const BASE_PATH = "/dashboard/inbox";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function buildHref(
  filters: AdminDocumentFiltersValue,
  patch: Partial<AdminDocumentFiltersValue>,
) {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

/** Filtros de Documentos: chips de estado + "Más filtros" (empresa, tipo, prioridad, fecha). */
export function AdminDocumentFilters({
  companies,
  filters,
}: {
  companies: Company[];
  filters: AdminDocumentFiltersValue;
}) {
  const advancedCount = [
    filters.company,
    filters.documentType,
    filters.priority,
    filters.uploadDate,
  ].filter(Boolean).length;
  const hasAnyFilter = advancedCount > 0 || Boolean(filters.status);

  const chips: { value: string; label: string }[] = [
    { value: "", label: "Todos" },
    ...DOCUMENT_STATUS_OPTIONS.map((status) => ({
      value: status,
      label: DOCUMENT_STATUS_LABELS[status],
    })),
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <nav aria-label="Estado" className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = (filters.status ?? "") === chip.value;
          return (
            <Link
              key={chip.value || "all"}
              href={buildHref(filters, { status: chip.value || undefined })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-10 items-center rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>

      <FilterPanel
        title="Más filtros"
        align="start"
        trigger={
          <Button variant="outline" className="h-10">
            <SlidersHorizontal className="size-4" />
            Más filtros
            {advancedCount > 0 ? (
              <span className="bg-primary text-primary-foreground ml-1 flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums">
                {advancedCount}
              </span>
            ) : null}
          </Button>
        }
      >
        <form method="get" action={BASE_PATH} className="space-y-3">
          {filters.status ? (
            <input type="hidden" name="status" value={filters.status} />
          ) : null}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Empresa</label>
            <Combobox
              name="company"
              defaultValue={filters.company ?? ""}
              options={companies.map((company) => ({
                value: company.id,
                label: company.name,
              }))}
              allLabel="Todas las empresas"
              placeholder="Todas las empresas"
              searchPlaceholder="Buscar empresa…"
              emptyMessage="Ninguna empresa coincide."
              aria-label="Empresa"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filtro-tipo" className="text-sm font-medium">
              Tipo de documento
            </label>
            <select
              id="filtro-tipo"
              name="documentType"
              defaultValue={filters.documentType ?? ""}
              className={selectClassName}
            >
              <option value="">Todos los tipos</option>
              {ADMIN_DOCUMENT_TYPE_FILTERS.map((type) => (
                <option key={type} value={type}>
                  {labelFor(DOCUMENT_TYPE_LABELS, type)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filtro-prioridad" className="text-sm font-medium">
              Prioridad
            </label>
            <select
              id="filtro-prioridad"
              name="priority"
              defaultValue={filters.priority ?? ""}
              className={selectClassName}
            >
              <option value="">Todas las prioridades</option>
              {Object.entries(DOCUMENT_PRIORITY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filtro-fecha" className="text-sm font-medium">
              Fecha de carga
            </label>
            <Input
              id="filtro-fecha"
              name="uploadDate"
              type="date"
              defaultValue={filters.uploadDate ?? ""}
              className="h-10"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="h-10 flex-1">
              Aplicar
            </Button>
            <Button asChild type="button" variant="outline" className="h-10">
              <Link href={buildHref({ status: filters.status }, {})}>
                Limpiar
              </Link>
            </Button>
          </div>
        </form>
      </FilterPanel>

      {hasAnyFilter ? (
        <Link
          href={BASE_PATH}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Quitar todo
        </Link>
      ) : null}
    </div>
  );
}
