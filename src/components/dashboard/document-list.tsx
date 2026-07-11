import Link from "next/link";

import { DocumentRow } from "@/components/dashboard/document-row";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { DocumentWithCompany } from "@/types";

type DocumentListProps = {
  documents: DocumentWithCompany[];
  title?: string;
  emptyMessage?: string;
  showCompany?: boolean;
  viewAllHref?: string;
  viewedDocumentIds: string[];
  profileId: string;
  isAdmin?: boolean;
};

export function DocumentList({
  documents,
  title = "Inbox",
  emptyMessage = "No items yet.",
  showCompany = false,
  viewAllHref,
  viewedDocumentIds,
  profileId,
  isAdmin = false,
}: DocumentListProps) {
  return (
    <SurfaceCard padding="md">
      <div className="mb-5 flex items-center justify-between gap-4 px-2">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </Link>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="px-2">
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              showCompany={showCompany}
              viewedDocumentIds={viewedDocumentIds}
              profileId={profileId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
