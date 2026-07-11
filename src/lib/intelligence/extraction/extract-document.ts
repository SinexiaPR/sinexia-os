import "server-only";

import type { ExtractionResult } from "@/lib/intelligence/types";

import { getFileExtension } from "@/lib/intelligence/extraction/utils";

/** Lazy-load extractors by extension. No PDF modules are imported at load time. */
export async function extractDocument(
  buffer: Buffer,
  filename: string,
): Promise<ExtractionResult> {
  const ext = getFileExtension(filename);

  if (ext === "pdf") {
    const { extractPdf } = await import("@/lib/intelligence/extraction/pdf");
    return extractPdf(buffer);
  }

  if (ext === "xlsx" || ext === "xls") {
    const { extractExcel } = await import("@/lib/intelligence/extraction/excel");
    return extractExcel(buffer, ext);
  }

  if (ext === "csv") {
    const { extractCsv } = await import("@/lib/intelligence/extraction/csv");
    return extractCsv(buffer);
  }

  return {
    text: "",
    chunks: [],
    requiresOcr: false,
    meta: { format: "unsupported" },
  };
}
