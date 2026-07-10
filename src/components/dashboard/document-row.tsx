import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getSignedFileUrl } from "@/services/documents";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type DocumentWithCompany,
} from "@/types";
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
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type;
}

export async function DocumentRow({
  document,
  showCompany = false,
  className,
}: DocumentRowProps) {
  const signedUrl = await getSignedFileUrl(document.file_url);
  const isPending =
    document.status === "received" || document.status === "reviewing";

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
          {isPending ? (
            <span className="inline-flex size-2 rounded-full bg-red-500/90" aria-hidden />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Factura {document.invoice_number} ·{" "}
          {documentTypeLabel(document.document_type)}
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
          <Link
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline"
          >
            Ver archivo
          </Link>
        ) : null}
      </div>
    </div>
  );
}
