export function parseMoney(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$€£,\s]/g, "").replace(/\(([^)]+)\)/, "-$1");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function findLabeledAmount(
  text: string,
  labels: RegExp[],
): number | null {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label.source}[^\\n\\d]{0,40}([\\d,.]+(?:\\.\\d{2})?)`, "i"),
    );
    const value = parseMoney(match?.[1]);
    if (value != null) return value;
  }
  return null;
}

export function findLabeledCount(
  text: string,
  labels: RegExp[],
): number | null {
  for (const label of labels) {
    const match = text.match(
      new RegExp(`${label.source}[^\\n\\d]{0,20}(\\d+)`, "i"),
    );
    if (match?.[1]) {
      const n = Number(match[1]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function countUniqueLines(
  text: string,
  pattern: RegExp,
  max = 5000,
): number | null {
  const matches = text.slice(0, max).match(new RegExp(pattern, "gi"));
  if (!matches?.length) return null;
  return new Set(matches.map((m) => m.trim().toLowerCase())).size;
}

export function countMatches(text: string, pattern: RegExp): number | null {
  const matches = text.match(new RegExp(pattern, "gi"));
  return matches?.length ?? null;
}

export function confidenceFromFields(
  fields: Array<number | string | null | undefined>,
): number {
  const filled = fields.filter(
    (v) => v != null && v !== "" && !(typeof v === "number" && Number.isNaN(v)),
  ).length;
  if (!fields.length) return 0;
  return Math.min(0.95, Math.max(0.15, filled / fields.length));
}

export function buildSummary(
  parts: Array<string | null | undefined>,
): string {
  return parts.filter(Boolean).join(" · ") || "Datos estructurados extraídos.";
}
