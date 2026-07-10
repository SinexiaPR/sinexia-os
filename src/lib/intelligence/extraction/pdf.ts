import { PDFParse } from "pdf-parse";

import { INTELLIGENCE_LIMITS } from "@/lib/intelligence/constants";
import type { ExtractedChunk, ExtractionResult } from "@/lib/intelligence/types";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

export async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText({
      first: INTELLIGENCE_LIMITS.maxPdfPages,
    });

    const pages = result.pages ?? [];
    const pageCount = result.total ?? pages.length;
    const rawText = (result.text ?? "").trim();
    const requiresOcr =
      rawText.length < INTELLIGENCE_LIMITS.minUsableTextChars;

    if (requiresOcr) {
      return {
        text: "",
        chunks: [],
        requiresOcr: true,
        meta: { pageCount, format: "pdf" },
      };
    }

    const chunks: ExtractedChunk[] = [];

    for (const page of pages.slice(0, INTELLIGENCE_LIMITS.maxPdfPages)) {
      const content = (page.text ?? "").trim();
      if (!content) continue;
      const pageNumber = page.num;

      for (
        let i = 0;
        i < content.length;
        i += INTELLIGENCE_LIMITS.maxChunkChars
      ) {
        if (chunks.length >= INTELLIGENCE_LIMITS.maxChunksPerDocument) break;
        chunks.push({
          content: content.slice(i, i + INTELLIGENCE_LIMITS.maxChunkChars),
          pageNumber: typeof pageNumber === "number" ? pageNumber : null,
          sheetName: null,
          rowReference: null,
        });
      }
    }

    // Fallback if pages array empty but text exists
    if (!chunks.length && rawText) {
      for (
        let i = 0;
        i < rawText.length && chunks.length < INTELLIGENCE_LIMITS.maxChunksPerDocument;
        i += INTELLIGENCE_LIMITS.maxChunkChars
      ) {
        chunks.push({
          content: rawText.slice(i, i + INTELLIGENCE_LIMITS.maxChunkChars),
          pageNumber: null,
          sheetName: null,
          rowReference: null,
        });
      }
    }

    return {
      text: truncate(rawText, INTELLIGENCE_LIMITS.maxExtractedTextChars),
      chunks: chunks.slice(0, INTELLIGENCE_LIMITS.maxChunksPerDocument),
      requiresOcr: false,
      meta: { pageCount, format: "pdf" },
    };
  } finally {
    await parser.destroy?.();
  }
}
