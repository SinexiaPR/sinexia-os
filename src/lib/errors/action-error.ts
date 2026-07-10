type ErrorRecord = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  name?: string;
};

export function extractErrorMessage(error: unknown): string {
  if (!error) {
    return "Error desconocido.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || error.name || "Error desconocido.";
  }

  if (typeof error === "object") {
    const record = error as ErrorRecord;
    const parts = [record.message, record.details, record.hint].filter(
      (part): part is string => Boolean(part),
    );

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return String(error);
}

export function logServerError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  console.error(`[${context}]`, {
    message: extractErrorMessage(error),
    error,
    ...meta,
  });
}

export function actionFailure(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>,
): { error: string } {
  logServerError(context, error, meta);

  const message = extractErrorMessage(error);
  return { error: message || `${context} failed.` };
}
