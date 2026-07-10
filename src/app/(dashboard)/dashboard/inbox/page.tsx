import type { Metadata } from "next";

import { DocumentUploadForm } from "@/components/dashboard/document-upload-form";
import { DocumentList } from "@/components/dashboard/document-list";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import {
  getAllDocuments,
  getDocumentsForCompany,
} from "@/services/documents";

export const metadata: Metadata = {
  title: "Documentos",
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
    <div className={isClient ? "space-y-8 pb-2 sm:space-y-10" : "space-y-10"}>
      {isClient ? (
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Documentos
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Envíe documentos desde su teléfono o computadora. Todo llega aquí
            automáticamente.
          </p>
        </header>
      ) : (
        <PageHeader
          eyebrow="Administración"
          title="Documentos"
          description="Todos los archivos enviados por las empresas clientes, en un solo lugar."
        />
      )}

      {isClient ? (
        <div id="upload" className="scroll-mt-24">
          <SurfaceCard padding="lg">
            <h2 className="text-base font-semibold tracking-tight">
              Enviar documento
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Tome una foto, elija de la galería o adjunte PDF, Word o Excel.
            </p>
            <div className="mt-6">
              <DocumentUploadForm />
            </div>
          </SurfaceCard>
        </div>
      ) : null}

      <DocumentList
        documents={items}
        title={isClient ? "Sus documentos" : "Todos los documentos"}
        showCompany={profile.role === "admin"}
        emptyMessage={
          isClient
            ? "No hay documentos aún. Envíe el primero arriba."
            : "Aún no hay documentos de ninguna empresa."
        }
      />

      {isClient ? <ContactSinexiaCard /> : null}
    </div>
  );
}
