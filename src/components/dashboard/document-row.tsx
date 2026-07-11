import { DocumentRowClient } from "@/components/dashboard/document-row-client";
import { getSignedFileUrl } from "@/services/documents";
import type { DocumentWithCompany } from "@/types";

type DocumentRowProps = {
  document: DocumentWithCompany;
  showCompany?: boolean;
  viewedDocumentIds: string[];
  profileId: string;
  isAdmin?: boolean;
  className?: string;
};

export async function DocumentRow({
  document,
  showCompany = false,
  viewedDocumentIds,
  profileId,
  isAdmin = false,
  className,
}: DocumentRowProps) {
  const signedUrl = await getSignedFileUrl(document.file_url);

  return (
    <DocumentRowClient
      document={document}
      showCompany={showCompany}
      signedUrl={signedUrl}
      viewedDocumentIds={viewedDocumentIds}
      profileId={profileId}
      isAdmin={isAdmin}
      className={className}
    />
  );
}
