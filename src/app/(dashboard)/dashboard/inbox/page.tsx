import type { Metadata } from "next";
import Link from "next/link";

import { DocumentUploadForm } from "@/components/dashboard/document-upload-form";
import { DocumentList } from "@/components/dashboard/document-list";
import { AdminDocumentFilters } from "@/components/dashboard/admin-document-filters";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PaginationLinks } from "@/components/ui/pagination-links";
import {
  CLIENT_DOCUMENT_FILTERS,
  countClientDocuments,
  filterClientDocuments,
  parseClientDocumentFilter,
} from "@/lib/documents/client-list";
import { paginate } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth/session";
import {
  getAllDocuments,
  getCompanies,
  getDocumentsForCompany,
} from "@/services/documents";
import type { AdminDocumentFiltersValue } from "@/services/documents";
import { getViewedDocumentIds } from "@/services/notifications";

export const metadata: Metadata = {
  title: "Documentos",
};

const DOCUMENTS_PAGE_SIZE = 15;

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireAuth();
  const params = await searchParams;
  const value = (key: string) =>
    typeof params[key] === "string" ? params[key] : undefined;
  const filters: AdminDocumentFiltersValue = {
    company: value("company"),
    documentType: value("documentType"),
    priority: value("priority"),
    status: value("status"),
    uploadDate: value("uploadDate"),
  };

  const allItems =
    profile.role === "admin"
      ? await getAllDocuments(filters)
      : profile.company_id
        ? await getDocumentsForCompany(profile.company_id)
        : [];

  const viewedDocumentIds = await getViewedDocumentIds(profile.id);

  const isClient = profile.role === "client";
  const clientFilter = parseClientDocumentFilter(filters.status);
  const clientCounts = countClientDocuments(allItems);
  // El cliente filtra por grupos de estado; el admin ya filtró en la consulta.
  const items = isClient
    ? filterClientDocuments(allItems, clientFilter)
    : allItems;
  const hasFilters = isClient
    ? clientFilter !== "all"
    : Object.values(filters).some(Boolean);
  const pageNumber = Number(value("page")) || 1;
  const view = paginate(items, pageNumber, DOCUMENTS_PAGE_SIZE);
  const hrefForPage = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, current] of Object.entries(filters)) {
      if (current) query.set(key, current);
    }
    if (nextPage > 1) query.set("page", String(nextPage));
    const text = query.toString();
    return text ? `/dashboard/inbox?${text}` : "/dashboard/inbox";
  };
  const companies = profile.role === "admin" ? await getCompanies() : [];

  return (
    <div className={isClient ? "space-y-5 pb-6 sm:space-y-6" : "space-y-12"}>
      {isClient ? (
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Envíe documentos desde su teléfono o computadora. Todo llega aquí
            automáticamente.
          </p>
        </header>
      ) : (
        <PageHeader
          title="Documentos"
          description="Todos los archivos que suben las empresas clientes, en un solo lugar."
        />
      )}

      {isClient ? (
        <div id="upload" className="scroll-mt-20">
          <SurfaceCard padding="lg">
            <h2 className="text-base font-semibold tracking-tight">
              Enviar documento
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Tome una foto o adjunte un archivo. Sinexia lo recibirá en sus
              documentos.
            </p>
            <div className="mt-6">
              <DocumentUploadForm />
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      {profile.role === "admin" ? (
        <AdminDocumentFilters companies={companies} filters={filters} />
      ) : null}

      {isClient ? (
        <nav
          aria-label="Estado de los documentos"
          className="flex flex-wrap gap-1.5"
        >
          {CLIENT_DOCUMENT_FILTERS.map((chip) => {
            const active = clientFilter === chip.value;
            return (
              <Link
                key={chip.value}
                href={
                  chip.value === "all"
                    ? "/dashboard/inbox"
                    : `/dashboard/inbox?status=${chip.value}`
                }
                aria-current={active ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {chip.label}
                <span className="tabular-nums opacity-80">
                  {clientCounts[chip.value]}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <DocumentList
        documents={view.items}
        title={isClient ? "Sus documentos" : "Todos los documentos"}
        showCompany={profile.role === "admin"}
        viewedDocumentIds={viewedDocumentIds}
        profileId={profile.id}
        isAdmin={profile.role === "admin"}
        emptyMessage={
          isClient
            ? hasFilters
              ? "No hay documentos en este estado"
              : "Aún no tiene documentos"
            : hasFilters
              ? "No hay documentos con estos filtros"
              : "Todavía no hay documentos"
        }
        emptyDescription={
          isClient
            ? hasFilters
              ? "Pruebe con otro estado."
              : "Envíe el primero con el formulario de arriba y Sinexia lo recibirá de inmediato."
            : hasFilters
              ? "Prueba con otro estado o quita los filtros."
              : "Cuando una empresa envíe un archivo, aparecerá aquí para que lo revises."
        }
        emptyAction={
          hasFilters ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/inbox">Quitar filtros</Link>
            </Button>
          ) : undefined
        }
      />

      <PaginationLinks view={view} hrefForPage={hrefForPage} />
    </div>
  );
}
