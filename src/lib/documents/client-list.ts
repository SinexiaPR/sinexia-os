import type { DocumentStatus } from "@/types";

export type ClientDocumentFilter = "all" | "pending" | "processed" | "rejected";

export const CLIENT_DOCUMENT_FILTERS: {
  value: ClientDocumentFilter;
  label: string;
}[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "processed", label: "Procesados" },
  { value: "rejected", label: "Falta información" },
];

const FILTER_STATUSES: Record<
  Exclude<ClientDocumentFilter, "all">,
  DocumentStatus[]
> = {
  pending: ["received", "reviewing"],
  processed: ["processed"],
  rejected: ["rejected"],
};

export function parseClientDocumentFilter(
  value: string | undefined,
): ClientDocumentFilter {
  return CLIENT_DOCUMENT_FILTERS.some((filter) => filter.value === value)
    ? (value as ClientDocumentFilter)
    : "all";
}

export function filterClientDocuments<T extends { status: DocumentStatus }>(
  documents: T[],
  filter: ClientDocumentFilter,
): T[] {
  if (filter === "all") return documents;
  const statuses = FILTER_STATUSES[filter];
  return documents.filter((document) => statuses.includes(document.status));
}

/** Cantidad de documentos por filtro, para mostrarla en cada chip. */
export function countClientDocuments(
  documents: { status: DocumentStatus }[],
): Record<ClientDocumentFilter, number> {
  return {
    all: documents.length,
    pending: filterClientDocuments(documents, "pending").length,
    processed: filterClientDocuments(documents, "processed").length,
    rejected: filterClientDocuments(documents, "rejected").length,
  };
}
