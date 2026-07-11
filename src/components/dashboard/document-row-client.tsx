"use client";

import { DocumentStatusBadge } from "@/components/dashboard/document-status-badge";
import { DocumentStatusSelect } from "@/components/dashboard/document-status-select";
import { DocumentViewLink } from "@/components/dashboard/document-view-link";
import { DocumentViewedIndicator } from "@/components/dashboard/document-viewed-indicator";
import { addLocalViewedDocument, useIsDocumentViewed } from "@/hooks/use-viewed-documents";
import type { DocumentWithCompany } from "@/types";
import { cn } from "@/lib/utils";

type DocumentRowClientProps = {
  document: DocumentWithCompany;
  showCompany?: boolean;
  signedUrl: string | null;
  viewedDocumentIds: string[];
  profileId: string;
  isAdmin?: boolean;
  className?: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

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

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        !isViewed &&
          "rounded-xl border border-red-500/15 bg-red-500/[0.03] px-3 -mx-1 sm:px-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{document.supplier}</p>
          <DocumentStatusBadge status={document.status} />
          <DocumentViewedIndicator isViewed={isViewed} />
        </div>
        <p className="text-sm text-muted-foreground">
          Invoice {document.invoice_number} · {document.document_type}
        </p>
        {showCompany && document.company ? (
          <p className="text-sm text-muted-foreground">{document.company.name}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <p className="font-medium text-foreground">
          {formatCurrency(document.amount)}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDate(document.invoice_date)}
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
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver archivo
            </DocumentViewLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}
