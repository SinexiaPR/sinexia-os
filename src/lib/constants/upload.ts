export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/** Full picker: camera (via separate input), gallery, PDF, Office docs */
export const UPLOAD_ACCEPT =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

/** Mobile camera capture */
export const CAMERA_ACCEPT = "image/*";

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".gif",
] as const;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".gif": "image/gif",
};

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index).toLowerCase();
}

export function isAllowedUploadFile(file: File): boolean {
  if (file.type.startsWith("image/")) {
    return true;
  }

  if (ALLOWED_MIME_TYPES.has(file.type)) {
    return true;
  }

  const extension = getExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(
    extension as (typeof ALLOWED_EXTENSIONS)[number],
  );
}

export function resolveUploadContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }

  const extension = getExtension(file.name);
  return EXTENSION_TO_MIME[extension] ?? "application/octet-stream";
}
