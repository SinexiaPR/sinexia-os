import type { Metadata } from "next";

import { DocumentUploadForm } from "@/components/dashboard/document-upload-form";
import { DocumentList } from "@/components/dashboard/document-list";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import {
  getAllDocuments,
  getDocumentsForCompany,
} from "@/services/documents";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  const profile = await requireAuth();

  const items =
    profile.role === "admin"
      ? await getAllDocuments()
      : profile.company_id
        ? await getDocumentsForCompany(profile.company_id)
        : [];

  const isClient = profile.role === "client";

  return (
    <div className={isClient ? "space-y-8 pb-6 sm:space-y-10" : "space-y-12"}>
      {isClient ? (
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Inbox
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
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
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Tome una foto o adjunte un archivo. Sinexia lo recibirá en su Inbox.
          </p>
          <div className="mt-6">
            <DocumentUploadForm />
          </div>
          </SurfaceCard>
        </div>
      ) : null}

      <DocumentList
        documents={items}
        title={isClient ? "Su Inbox" : "All Inbox items"}
        showCompany={profile.role === "admin"}
        emptyMessage={
          isClient
            ? "Su Inbox está vacío. Envíe su primer documento arriba."
            : "No items in any client Inbox yet."
        }
      />
    </div>
  );
}
