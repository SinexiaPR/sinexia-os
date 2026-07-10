import * as XLSX from "xlsx";
import { INTELLIGENCE_LIMITS } from "@/lib/intelligence/constants";
import type { ExtractedChunk, ExtractionResult } from "@/lib/intelligence/types";

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function rowsToTableChunk(
  headers: string[],
  rows: string[][],
  sheetName: string,
  startRow: number,
  _endRow: number,
): string {
  const headerLine = headers.join(" | ");
  const body = rows
    .map((r, i) => `R${startRow + i}: ${r.join(" | ")}`)
    .join("\n");
  return `Sheet: ${sheetName}\nHeaders: ${headerLine}\n${body}`;
}

export function extractExcel(
  buffer: Buffer,
  format: "xlsx" | "xls",
): ExtractionResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    sheetStubs: false,
  });

  const chunks: ExtractedChunk[] = [];
  const textParts: string[] = [];
  let totalRows = 0;
  const sheetNames = workbook.SheetNames.slice(0, INTELLIGENCE_LIMITS.maxSheets);

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
      sheet,
      { header: 1, defval: null, raw: false },
    ) as unknown[][];

    if (!matrix.length) continue;

    const limited = matrix.slice(0, INTELLIGENCE_LIMITS.maxRowsPerSheet + 1);
    const headerRow = (limited[0] ?? []).map(cellToString);
    const dataRows = limited.slice(1).map((row) =>
      (row as unknown[]).map(cellToString),
    );
    totalRows += dataRows.length;

    textParts.push(
      `\n=== Sheet: ${sheetName} ===\n${headerRow.join(" | ")}\n` +
        dataRows
          .slice(0, 50)
          .map((r, i) => `R${i + 2}: ${r.join(" | ")}`)
          .join("\n"),
    );

    const batchSize = 40;
    for (let i = 0; i < dataRows.length; i += batchSize) {
      if (chunks.length >= INTELLIGENCE_LIMITS.maxChunksPerDocument) break;
      const batch = dataRows.slice(i, i + batchSize);
      const startRow = i + 2;
      const endRow = startRow + batch.length - 1;
      const content = rowsToTableChunk(
        headerRow,
        batch,
        sheetName,
        startRow,
        endRow,
      );
      chunks.push({
        content: content.slice(0, INTELLIGENCE_LIMITS.maxChunkChars),
        pageNumber: null,
        sheetName,
        rowReference: `rows ${startRow}-${endRow}`,
      });
    }
  }

  const text = textParts.join("\n").trim();
  const requiresOcr = text.length < INTELLIGENCE_LIMITS.minUsableTextChars;

  return {
    text: text.slice(0, INTELLIGENCE_LIMITS.maxExtractedTextChars),
    chunks: chunks.slice(0, INTELLIGENCE_LIMITS.maxChunksPerDocument),
    requiresOcr,
    meta: {
      sheetCount: sheetNames.length,
      rowCount: totalRows,
      format,
    },
  };
}
