"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Download,
  Filter,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import { deleteDocument, updateDocumentStatus } from "@/actions/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  documentFileName,
  documentTypeLabel,
  formatDateEs,
  formatFileSize,
  isSameDayOrAfter,
  isSameDayOrBefore,
  matchesSearch,
  sortDocuments,
  type DocumentSort,
} from "@/lib/portal/format";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  type DocumentStatus,
  type DocumentWithCompany,
  type Profile,
} from "@/types";

type DocumentCenterProps = {
  documents: DocumentWithCompany[];
  profile: Profile;
  companies?: { id: string; name: string }[];
  signedUrls: Record<string, string | null>;
  highlightId?: string | null;
};

const selectClassName =
  "flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function StatusSelect({
  documentId,
  status,
}: {
  documentId: string;
  status: DocumentStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <select
        value={value}
        disabled={isPending}
        className={cn(selectClassName, "h-10 min-w-[10rem]")}
        aria-label="Cambiar estado"
        onChange={(event) => {
          const next = event.target.value as DocumentStatus;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await updateDocumentStatus(documentId, next);
            if (result.error) {
              setValue(status);
              setError(result.error);
            }
          });
        }}
      >
        {DOCUMENT_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {DOCUMENT_STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={isPending}
      className="size-10 shrink-0"
      aria-label="Eliminar documento"
      onClick={() => {
        const confirmed = window.confirm(
          "¿Eliminar este documento? Esta acción no se puede deshacer.",
        );
        if (!confirmed) return;
        startTransition(async () => {
          await deleteDocument(documentId);
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function DocumentCenter({
  documents,
  profile,
  companies = [],
  signedUrls,
  highlightId,
}: DocumentCenterProps) {
  const isAdmin = profile.role === "admin";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [companyId, setCompanyId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<DocumentSort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = documents.filter((doc) => {
      const name = documentFileName(doc.file_url);
      const searchTarget = [
        name,
        doc.supplier,
        doc.invoice_number,
        doc.company?.name ?? "",
      ].join(" ");

      if (!matchesSearch(searchTarget, query)) return false;
      if (status !== "all" && doc.status !== status) return false;
      if (type !== "all" && doc.document_type !== type) return false;
      if (companyId !== "all" && doc.company_id !== companyId) return false;
      if (!isSameDayOrAfter(doc.created_at, dateFrom)) return false;
      if (!isSameDayOrBefore(doc.created_at, dateTo)) return false;
      return true;
    });

    return sortDocuments(list, sort);
  }, [documents, query, status, type, companyId, dateFrom, dateTo, sort]);

  const filterControls = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="doc-status">Estado</Label>
        <select
          id="doc-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClassName}
        >
          <option value="all">Todos</option>
          {DOCUMENT_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {DOCUMENT_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-type">Tipo</Label>
        <select
          id="doc-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={selectClassName}
        >
          <option value="all">Todos</option>
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {documentTypeLabel(option)}
            </option>
          ))}
        </select>
      </div>

      {isAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="doc-company">Empresa</Label>
          <select
            id="doc-company"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className={selectClassName}
          >
            <option value="all">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="doc-from">Desde</Label>
        <Input
          id="doc-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-to">Hasta</Label>
        <Input
          id="doc-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="doc-sort">Orden</Label>
        <select
          id="doc-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as DocumentSort)}
          className={selectClassName}
        >
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguos</option>
          <option value="name">Nombre</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAdmin
                ? "Buscar por archivo, proveedor o empresa…"
                : "Buscar por nombre de archivo…"
            }
            className="h-12 rounded-xl pl-10 text-base sm:h-11 sm:text-sm"
            aria-label="Buscar documentos"
          />
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 gap-2 rounded-xl sm:hidden"
            >
              <Filter className="size-4" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-5">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            {filterControls}
            <Button
              type="button"
              className="mt-6 h-12 w-full rounded-xl"
              onClick={() => setFiltersOpen(false)}
            >
              Aplicar
            </Button>
          </SheetContent>
        </Sheet>
      </div>

      <SurfaceCard padding="md" className="hidden sm:block">
        {filterControls}
      </SurfaceCard>

      <p className="text-sm text-muted-foreground">
        {filtered.length} documento{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <SurfaceCard padding="lg">
          <div className="py-12 text-center">
            <p className="font-medium text-foreground">Sin documentos</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No hay resultados con los filtros actuales.
            </p>
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => {
            const name = documentFileName(doc.file_url);
            const size = formatFileSize(doc.file_size);
            const url = signedUrls[doc.id];
            const highlighted = highlightId === doc.id;

            return (
              <SurfaceCard
                key={doc.id}
                id={`doc-${doc.id}`}
                padding="md"
                className={cn(
                  highlighted && "border-primary/30 ring-1 ring-primary/20",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {name}
                      </p>
                      <Badge variant={doc.status}>
                        {DOCUMENT_STATUS_LABELS[doc.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {documentTypeLabel(doc.document_type)} ·{" "}
                      {formatDateEs(doc.created_at)}
                      {size ? ` · ${size}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {doc.supplier} · Factura {doc.invoice_number}
                    </p>
                    {isAdmin && doc.company ? (
                      <p className="text-sm font-medium text-primary">
                        {doc.company.name}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isAdmin ? (
                      <StatusSelect documentId={doc.id} status={doc.status} />
                    ) : null}

                    {url ? (
                      <Button asChild variant="outline" className="h-10 gap-2 rounded-xl">
                        <Link href={url} target="_blank" rel="noopener noreferrer">
                          <Download className="size-4" />
                          Descargar
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No disponible
                      </span>
                    )}

                    {!isAdmin && doc.status === "received" ? (
                      <DeleteDocumentButton documentId={doc.id} />
                    ) : null}
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
