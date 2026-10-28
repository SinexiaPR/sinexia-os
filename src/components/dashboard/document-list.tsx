import Link from "next/link";
import { Folder } from "lucide-react";
import type { ReactNode } from "react";

import { DocumentRow } from "@/components/dashboard/document-row";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { DocumentWithCompany } from "@/types";

type DocumentListProps = {
  documents: DocumentWithCompany[];
  title?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  showCompany?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
  viewedDocumentIds: string[];
  profileId: string;
  isAdmin?: boolean;
};

export function DocumentList({
  documents,
  title = "Documentos",
  emptyMessage = "Aún no hay documentos.",
  emptyDescription,
  emptyAction,
  showCompany = false,
  viewAllHref,
  viewAllLabel = "Ver todos",
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
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <EmptyState
          icon={Folder}
          title={emptyMessage}
          description={emptyDescription}
          action={emptyAction}
        />
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
