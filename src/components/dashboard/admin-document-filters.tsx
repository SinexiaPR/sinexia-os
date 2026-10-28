import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { ADMIN_DOCUMENT_TYPE_FILTERS } from "@/lib/documents/upload-metadata";
import { DOCUMENT_TYPE_LABELS, labelFor } from "@/lib/labels";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  type Company,
} from "@/types";
import type { AdminDocumentFiltersValue } from "@/services/documents";

const selectClassName =
  "h-10 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function AdminDocumentFilters({
  companies,
  filters,
}: {
  companies: Company[];
  filters: AdminDocumentFiltersValue;
}) {
  return (
    <form
      method="get"
      className="border-border/70 bg-muted/20 mb-6 grid gap-3 rounded-md border p-4 sm:grid-cols-2 xl:grid-cols-5"
    >
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
      <select
        name="documentType"
        defaultValue={filters.documentType ?? ""}
        className={selectClassName}
        aria-label="Tipo de documento"
      >
        <option value="">Todos los tipos</option>
        {ADMIN_DOCUMENT_TYPE_FILTERS.map((type) => (
          <option key={type} value={type}>
            {labelFor(DOCUMENT_TYPE_LABELS, type)}
          </option>
        ))}
      </select>
      <select
        name="priority"
        defaultValue={filters.priority ?? ""}
        className={selectClassName}
        aria-label="Prioridad"
      >
        <option value="">Todas las prioridades</option>
        <option value="routine">Rutina</option>
        <option value="urgent">Urgente</option>
      </select>
      <select
        name="status"
        defaultValue={filters.status ?? ""}
        className={selectClassName}
        aria-label="Estado"
      >
        <option value="">Todos los estados</option>
        {DOCUMENT_STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {DOCUMENT_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <Input
        name="uploadDate"
        type="date"
        defaultValue={filters.uploadDate ?? ""}
        className="h-10 rounded-md"
        aria-label="Fecha de carga"
      />
      <div className="flex gap-2 sm:col-span-2 xl:col-span-5">
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        <Button asChild type="button" size="sm" variant="outline">
          <Link href="/dashboard/inbox">Limpiar</Link>
        </Button>
      </div>
    </form>
  );
}
