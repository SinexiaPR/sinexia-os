import { Badge } from "@/components/ui/badge";
import { DOCUMENT_STATUS_LABELS, type DocumentStatus } from "@/types";

type DocumentStatusBadgeProps = {
  status: DocumentStatus;
};

export function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  return (
    <Badge variant={status}>{DOCUMENT_STATUS_LABELS[status]}</Badge>
  );
}
