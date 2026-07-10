import { parse } from "csv-parse/sync";
import { INTELLIGENCE_LIMITS } from "@/lib/intelligence/constants";
import type { ExtractedChunk, ExtractionResult } from "@/lib/intelligence/types";

export function extractCsv(buffer: Buffer): ExtractionResult {
  const raw = buffer.toString("utf8");
  let records: string[][] = [];

  try {
    records = parse(raw, {
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      to: INTELLIGENCE_LIMITS.maxRowsPerSheet + 1,
    }) as string[][];
  } catch {
    return {
      text: "",
      chunks: [],
      requiresOcr: false,
      meta: { format: "csv", rowCount: 0 },
    };
  }

  if (!records.length) {
    return {
      text: "",
      chunks: [],
      requiresOcr: false,
      meta: { format: "csv", rowCount: 0 },
    };
  }

  const headers = records[0] ?? [];
  const dataRows = records.slice(1);
  const chunks: ExtractedChunk[] = [];
  const batchSize = 40;

  for (let i = 0; i < dataRows.length; i += batchSize) {
    if (chunks.length >= INTELLIGENCE_LIMITS.maxChunksPerDocument) break;
    const batch = dataRows.slice(i, i + batchSize);
    const startRow = i + 2;
    const endRow = startRow + batch.length - 1;
    const body = batch
      .map((r, idx) => `R${startRow + idx}: ${r.join(" | ")}`)
      .join("\n");
    chunks.push({
      content: `CSV Headers: ${headers.join(" | ")}\n${body}`.slice(
        0,
        INTELLIGENCE_LIMITS.maxChunkChars,
      ),
      pageNumber: null,
      sheetName: null,
      rowReference: `rows ${startRow}-${endRow}`,
    });
  }

  const preview =
    `Headers: ${headers.join(" | ")}\n` +
    dataRows
      .slice(0, 80)
      .map((r, i) => `R${i + 2}: ${r.join(" | ")}`)
      .join("\n");

  return {
    text: preview.slice(0, INTELLIGENCE_LIMITS.maxExtractedTextChars),
    chunks,
    requiresOcr: preview.trim().length < INTELLIGENCE_LIMITS.minUsableTextChars,
    meta: { format: "csv", rowCount: dataRows.length },
  };
}
