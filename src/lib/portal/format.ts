import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type DocumentWithCompany,
  type ReportWithCompany,
} from "@/types";

export function documentFileName(fileUrl: string): string {
  const parts = fileUrl.split("/");
  return parts[parts.length - 1] || fileUrl;
}

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type;
}

export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateEs(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTimeEs(date: string): string {
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function matchesSearch(haystack: string, query: string): boolean {
  if (!query.trim()) return true;
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export function isSameDayOrAfter(iso: string, dateInput: string): boolean {
  if (!dateInput) return true;
  return new Date(iso).getTime() >= new Date(`${dateInput}T00:00:00`).getTime();
}

export function isSameDayOrBefore(iso: string, dateInput: string): boolean {
  if (!dateInput) return true;
  return new Date(iso).getTime() <= new Date(`${dateInput}T23:59:59.999`).getTime();
}

export type DocumentSort = "newest" | "oldest" | "name";
export type ReportSort = "newest" | "oldest" | "title";

export function sortDocuments(
  documents: DocumentWithCompany[],
  sort: DocumentSort,
): DocumentWithCompany[] {
  const copy = [...documents];
  switch (sort) {
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "name":
      return copy.sort((a, b) =>
        documentFileName(a.file_url).localeCompare(
          documentFileName(b.file_url),
          "es",
        ),
      );
    case "newest":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

export function sortReports(
  reports: ReportWithCompany[],
  sort: ReportSort,
): ReportWithCompany[] {
  const copy = [...reports];
  switch (sort) {
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    case "newest":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}
