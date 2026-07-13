import { extractErrorMessage, logServerError } from "@/lib/errors/action-error";
import type { ReportActionState } from "@/types/reports";

export function reportSuccess(): ReportActionState {
  return { success: true };
}

export function reportError(
  error: unknown,
  context: string,
  meta?: Record<string, unknown>,
): ReportActionState {
  logServerError(context, error, meta);
  return {
    success: false,
    error: extractErrorMessage(error) || `${context} failed.`,
  };
}

export function validationError(message: string): ReportActionState {
  return { success: false, error: message };
}
