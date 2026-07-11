import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_DOCUMENT_TYPE_FILTERS } from "@/lib/documents/upload-metadata";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  type Company,
} from "@/types";
import type { AdminDocumentFiltersValue } from "@/services/documents";

const selectClassName =
  "h-10 rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
      className="border-border/70 bg-muted/20 mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      <select
        name="company"
        defaultValue={filters.company ?? ""}
        className={selectClassName}
        aria-label="Company"
      >
        <option value="">All companies</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      <select
        name="documentType"
        defaultValue={filters.documentType ?? ""}
        className={selectClassName}
        aria-label="Document type"
      >
        <option value="">All document types</option>
        {ADMIN_DOCUMENT_TYPE_FILTERS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <select
        name="priority"
        defaultValue={filters.priority ?? ""}
        className={selectClassName}
        aria-label="Priority"
      >
        <option value="">All priorities</option>
        <option value="routine">Routine</option>
        <option value="urgent">Urgent</option>
      </select>
      <select
        name="status"
        defaultValue={filters.status ?? ""}
        className={selectClassName}
        aria-label="Workflow status"
      >
        <option value="">All statuses</option>
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
        className="h-10 rounded-xl"
        aria-label="Upload date"
      />
      <div className="flex gap-2 sm:col-span-2 xl:col-span-5">
        <Button type="submit" size="sm">
          Filter
        </Button>
        <Button asChild type="button" size="sm" variant="outline">
          <Link href="/dashboard/inbox">Clear</Link>
        </Button>
      </div>
    </form>
  );
}
