import { extractErrorMessage, logServerError } from "@/lib/errors/action-error";
import type { ReportActionState } from "@/types/reports";

export function reportSuccess(): ReportActionState {
  const result: ReportActionState = { success: true };
  console.log("[createReport] returning:", result);
  return result;
}

export function reportError(
  error: unknown,
  context: string,
  meta?: Record<string, unknown>,
): ReportActionState {
  logServerError(context, error, meta);
  const result: ReportActionState = {
    success: false,
    error: extractErrorMessage(error) || `No se pudo completar: ${context}.`,
  };
  console.log("[createReport] returning:", result);
  return result;
}

export function validationError(message: string): ReportActionState {
  const result: ReportActionState = { success: false, error: message };
  console.log("[createReport] returning:", result);
  return result;
}
