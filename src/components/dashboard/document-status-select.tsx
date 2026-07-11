"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateDocumentStatus } from "@/actions/documents";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
  type DocumentStatus,
} from "@/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-9 min-w-[10.5rem] rounded-lg border border-input bg-transparent px-2.5 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

type DocumentStatusSelectProps = {
  documentId: string;
  status: DocumentStatus;
  className?: string;
};

export function DocumentStatusSelect({
  documentId,
  status,
  className,
}: DocumentStatusSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as DocumentStatus;
    if (nextStatus === status) return;

    startTransition(async () => {
      const result = await updateDocumentStatus(documentId, nextStatus);
      if (result.error) {
        console.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Estado del documento"
      className={cn(selectClassName, className)}
    >
      {DOCUMENT_STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {DOCUMENT_STATUS_LABELS[option]}
        </option>
      ))}
    </select>
  );
}
