import type { Metadata } from "next";

import { DocumentUploadForm } from "@/components/dashboard/document-upload-form";
import { DocumentList } from "@/components/dashboard/document-list";
import { AdminDocumentFilters } from "@/components/dashboard/admin-document-filters";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import {
  getAllDocuments,
  getCompanies,
  getDocumentsForCompany,
} from "@/services/documents";
import type { AdminDocumentFiltersValue } from "@/services/documents";
import { getViewedDocumentIds } from "@/services/notifications";

export const metadata: Metadata = {
  title: "Inbox",
};

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

  const items =
    profile.role === "admin"
      ? await getAllDocuments(filters)
      : profile.company_id
        ? await getDocumentsForCompany(profile.company_id)
        : [];

  const viewedDocumentIds = await getViewedDocumentIds(profile.id);

  const isClient = profile.role === "client";
  const companies = profile.role === "admin" ? await getCompanies() : [];

  return (
    <div className={isClient ? "space-y-8 pb-6 sm:space-y-10" : "space-y-12"}>
      {isClient ? (
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Inbox
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-base">
            Envíe documentos desde su teléfono o computadora. Todo llega aquí
            automáticamente.
          </p>
        </header>
      ) : (
        <PageHeader
          eyebrow="Admin workspace"
          title="Inbox"
          description="All files uploaded by client companies, in one place."
        />
      )}

      {isClient ? (
        <div id="upload" className="scroll-mt-20">
          <SurfaceCard padding="lg">
            <h2 className="text-base font-semibold tracking-tight">
              Enviar documento
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Tome una foto o adjunte un archivo. Sinexia lo recibirá en su
              Inbox.
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

      <DocumentList
        documents={items}
        title={isClient ? "Su Inbox" : "All Inbox items"}
        showCompany={profile.role === "admin"}
        viewedDocumentIds={viewedDocumentIds}
        profileId={profile.id}
        isAdmin={profile.role === "admin"}
        emptyMessage={
          isClient
            ? "Su Inbox está vacío. Envíe su primer documento arriba."
            : "No items in any client Inbox yet."
        }
      />
    </div>
  );
}
