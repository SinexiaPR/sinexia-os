import { ANALYZABLE_EXTENSIONS } from "@/lib/intelligence/constants";
import { extractCsv } from "@/lib/intelligence/extraction/csv";
import { extractExcel } from "@/lib/intelligence/extraction/excel";
import { extractPdf } from "@/lib/intelligence/extraction/pdf";
import type { ExtractionResult } from "@/lib/intelligence/types";

export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() as string) : "";
}

export function isAnalyzableFilename(filename: string): boolean {
  return ANALYZABLE_EXTENSIONS.has(getFileExtension(filename));
}

export async function extractDocument(
  buffer: Buffer,
  filename: string,
): Promise<ExtractionResult> {
  const ext = getFileExtension(filename);

  if (ext === "pdf") {
    return extractPdf(buffer);
  }
  if (ext === "xlsx" || ext === "xls") {
    return extractExcel(buffer, ext);
  }
  if (ext === "csv") {
    return extractCsv(buffer);
  }

  return {
    text: "",
    chunks: [],
    requiresOcr: false,
    meta: { format: "unsupported" },
  };
}
