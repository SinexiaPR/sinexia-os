import type { Metadata } from "next";

import { DocumentUploadForm } from "@/components/dashboard/document-upload-form";
import { DocumentCenter } from "@/components/dashboard/document-center";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollToHighlight } from "@/components/portal/scroll-to-highlight";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import {
  getAllDocuments,
  getCompanies,
  getDocumentsForCompany,
  getSignedFileUrl,
} from "@/services/documents";

export const metadata: Metadata = {
  title: "Documentos",
};

type InboxPageProps = {
  searchParams?: Promise<{ doc?: string }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const profile = await requireAuth();
  const params = searchParams ? await searchParams : {};
  const highlightId = params.doc ?? null;

  const isAdmin = profile.role === "admin";

  const [items, companies] = await Promise.all([
    isAdmin
      ? getAllDocuments()
      : profile.company_id
        ? getDocumentsForCompany(profile.company_id)
        : Promise.resolve([]),
    isAdmin ? getCompanies() : Promise.resolve([]),
  ]);

  const signedUrls: Record<string, string | null> = {};
  await Promise.all(
    items.map(async (doc) => {
      signedUrls[doc.id] = await getSignedFileUrl(doc.file_url);
    }),
  );

  return (
    <div className={isAdmin ? "space-y-10" : "space-y-8 pb-2 sm:space-y-10"}>
      {isAdmin ? (
        <PageHeader
          eyebrow="Administración"
          title="Documentos"
          description="Centro de documentos de todas las empresas clientes."
        />
      ) : (
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Documentos
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Envíe, busque y gestione los documentos de su empresa.
          </p>
        </header>
      )}

      {!isAdmin ? (
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

      <DocumentCenter
        documents={items}
        profile={profile}
        companies={companies}
        signedUrls={signedUrls}
        highlightId={highlightId}
      />

      <ScrollToHighlight id={highlightId} prefix="doc" />

      {!isAdmin ? <ContactSinexiaCard /> : null}
    </div>
  );
}
