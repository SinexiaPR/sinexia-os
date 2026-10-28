import { DocumentList } from "@/components/dashboard/document-list";
import { requireAdmin } from "@/lib/auth/session";
import { getAllDocuments } from "@/services/documents";
import { getViewedDocumentIds } from "@/services/notifications";

export const dynamic = "force-dynamic";

export default async function CompanyDocumentsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const profile = await requireAdmin();
  const { companyId } = await params;
  const [documents, viewedDocumentIds] = await Promise.all([
    getAllDocuments({ company: companyId }),
    getViewedDocumentIds(profile.id),
  ]);

  return (
    <DocumentList
      documents={documents}
      title="Documentos de la empresa"
      emptyMessage="Esta empresa todavía no ha enviado documentos."
      viewedDocumentIds={viewedDocumentIds}
      profileId={profile.id}
      isAdmin
      viewAllHref={`/dashboard/inbox?company=${companyId}`}
      viewAllLabel="Abrir en Documentos"
    />
  );
}
