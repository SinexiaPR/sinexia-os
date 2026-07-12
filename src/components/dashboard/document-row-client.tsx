"use client";

import { DocumentStatusBadge } from "@/components/dashboard/document-status-badge";
import { DocumentStatusSelect } from "@/components/dashboard/document-status-select";
import { DocumentViewLink } from "@/components/dashboard/document-view-link";
import { DocumentViewedIndicator } from "@/components/dashboard/document-viewed-indicator";
import {
  addLocalViewedDocument,
  useIsDocumentViewed,
} from "@/hooks/use-viewed-documents";
import type { DocumentWithCompany } from "@/types";
import { cn } from "@/lib/utils";
import { getDocumentDisplayType } from "@/lib/documents/upload-metadata";

type DocumentRowClientProps = {
  document: DocumentWithCompany;
  showCompany?: boolean;
  signedUrl: string | null;
  viewedDocumentIds: string[];
  profileId: string;
  isAdmin?: boolean;
  className?: string;
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function DocumentRowClient({
  document,
  showCompany = false,
  signedUrl,
  viewedDocumentIds,
  profileId,
  isAdmin = false,
  className,
}: DocumentRowClientProps) {
  const isViewed = useIsDocumentViewed(
    document.id,
    viewedDocumentIds,
    profileId,
  );

  function markLocalViewed() {
    addLocalViewedDocument(profileId, document.id);
  }

  const fileName = document.file_url.split("/").pop() ?? "Document";
  const displayType = getDocumentDisplayType(document);

  return (
    <div
      className={cn(
        "border-border/60 flex flex-col gap-3 border-b py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        !isViewed &&
          "-mx-1 rounded-xl border border-red-500/15 bg-red-500/[0.03] px-3 sm:px-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground font-medium">{displayType}</p>
          {document.priority === "urgent" ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/15 ring-inset">
              {isAdmin ? "Urgente" : "Urgent"}
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              {isAdmin ? "Rutina" : "Routine"}
            </span>
          )}
          <DocumentStatusBadge status={document.status} />
          <DocumentViewedIndicator isViewed={isViewed} />
        </div>
        <p className="text-muted-foreground text-sm">{fileName}</p>
        {showCompany && document.company ? (
          <p className="text-muted-foreground text-sm">
            {document.company.name}
          </p>
        ) : null}
        {isAdmin && document.comment ? (
          <p className="text-foreground/80 max-w-2xl text-sm">
            {document.comment}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <p className="text-muted-foreground text-sm">
          {formatDate(document.created_at)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <DocumentStatusSelect
              documentId={document.id}
              status={document.status}
            />
          ) : null}
          {signedUrl ? (
            <DocumentViewLink
              documentId={document.id}
              href={signedUrl}
              onViewed={markLocalViewed}
              className="text-primary text-sm font-medium hover:underline"
            >
              Ver archivo
            </DocumentViewLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
