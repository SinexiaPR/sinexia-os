import { ANALYZABLE_EXTENSIONS } from "@/lib/intelligence/constants";

export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() as string) : "";
}

export function isAnalyzableFilename(filename: string): boolean {
  return ANALYZABLE_EXTENSIONS.has(getFileExtension(filename));
}
