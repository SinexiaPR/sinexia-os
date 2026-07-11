export const CLIENT_DOCUMENT_TYPES = [
  "Invoice",
  "Receipt",
  "Bank Statement",
  "Payment Receipt",
  "Payroll / Timesheets",
  "Tax Document",
  "Contract",
  "Identification",
  "Other",
] as const;

export const DOCUMENT_PRIORITIES = ["routine", "urgent"] as const;

export const ADMIN_DOCUMENT_TYPE_FILTERS = [
  ...CLIENT_DOCUMENT_TYPES,
  "Credit Note",
  "Statement",
] as const;

export type ClientDocumentType = (typeof CLIENT_DOCUMENT_TYPES)[number];
export type DocumentPriority = (typeof DOCUMENT_PRIORITIES)[number];

export const DOCUMENT_COMMENT_MAX_LENGTH = 500;
export const DOCUMENT_TYPE_DESCRIPTION_MAX_LENGTH = 120;

export function validateDocumentUploadMetadata(values: {
  documentType: string;
  priority: string;
  comment: string;
  typeDescription: string;
}): { error?: string } {
  if (
    !CLIENT_DOCUMENT_TYPES.includes(values.documentType as ClientDocumentType)
  ) {
    return { error: "Tipo de documento no válido." };
  }
  if (!DOCUMENT_PRIORITIES.includes(values.priority as DocumentPriority)) {
    return { error: "Prioridad no válida." };
  }
  if (values.comment.length > DOCUMENT_COMMENT_MAX_LENGTH) {
    return { error: "El comentario no puede superar los 500 caracteres." };
  }
  if (values.typeDescription.length > DOCUMENT_TYPE_DESCRIPTION_MAX_LENGTH) {
    return { error: "La descripción es demasiado larga." };
  }
  return {};
}

export function getDocumentDisplayType(values: {
  document_type: string;
  document_type_description?: string | null;
}) {
  return values.document_type === "Other" && values.document_type_description
    ? `Other · ${values.document_type_description}`
    : values.document_type;
}
