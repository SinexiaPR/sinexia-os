import { DocumentViewLink } from "@/components/dashboard/document-view-link";
import { Badge } from "@/components/ui/badge";
import { getSignedFileUrl } from "@/services/documents";
import { DOCUMENT_STATUS_LABELS, type DocumentWithCompany } from "@/types";
import { cn } from "@/lib/utils";

type DocumentRowProps = {
  document: DocumentWithCompany;
  showCompany?: boolean;
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

export async function DocumentRow({
  document,
  showCompany = false,
  className,
}: DocumentRowProps) {
  const signedUrl = await getSignedFileUrl(document.file_url);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{document.supplier}</p>
          <Badge variant={document.status}>
            {DOCUMENT_STATUS_LABELS[document.status]}
          </Badge>
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
        {signedUrl ? (
          <DocumentViewLink
            documentId={document.id}
            href={signedUrl}
            className="text-sm font-medium text-primary hover:underline"
          >
            View file
          </DocumentViewLink>
        ) : null}
      </div>
    </div>
  );
}
