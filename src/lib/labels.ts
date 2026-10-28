// Diccionario central de etiquetas legibles (español) para valores internos.
// Toda cadena que venga de la base de datos o de un enum debe pasar por aquí
// antes de mostrarse, para no filtrar valores crudos como `not_configured`.

export const INVOICE_STATUS_LABELS = {
  draft: "Borrador",
  issued: "Emitida",
  sent: "Enviada",
  viewed: "Vista",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
} as const;

/** Estados de factura tal como los ve el cliente (emitida/enviada/vista = por pagar). */
export const CLIENT_INVOICE_STATUS_LABELS = {
  draft: "Borrador",
  issued: "Pendiente de pago",
  sent: "Pendiente de pago",
  viewed: "Pendiente de pago",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
} as const;

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Color semántico de cada estado de factura. */
export const INVOICE_STATUS_TONES: Record<
  keyof typeof INVOICE_STATUS_LABELS,
  Tone
> = {
  draft: "neutral",
  issued: "info",
  sent: "info",
  viewed: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
};

export const CLIENT_INVOICE_STATUS_TONES: Record<
  keyof typeof CLIENT_INVOICE_STATUS_LABELS,
  Tone
> = {
  draft: "neutral",
  issued: "warning",
  sent: "warning",
  viewed: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
};

export const DELIVERY_STATUS_LABELS = {
  pending: "Pendiente",
  sent: "Enviado",
  failed: "Falló",
  not_configured: "No configurado",
} as const;

export const DOCUMENT_PRIORITY_LABELS = {
  routine: "Rutina",
  urgent: "Urgente",
} as const;

// Los valores en inglés se guardan así en la base de datos y en los filtros;
// solo cambia lo que se muestra.
export const DOCUMENT_TYPE_LABELS = {
  Invoice: "Factura",
  Receipt: "Recibo",
  "Bank Statement": "Estado bancario",
  "Payment Receipt": "Comprobante de pago",
  "Payroll / Timesheets": "Nómina / Horas",
  "Tax Document": "Documento tributario",
  Contract: "Contrato",
  Identification: "Identificación",
  Other: "Otro",
  "Credit Note": "Nota de crédito",
  Statement: "Estado de cuenta",
} as const;

export const SEMAPHORE_LABELS = {
  green: "Al día",
  amber: "Con pendientes",
  red: "Atención urgente",
} as const;

type Dictionary = Readonly<Record<string, string>>;

/** "not_configured" → "Not configured" como último recurso, nunca el valor crudo. */
function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "—";
}

/**
 * Devuelve la etiqueta en español de `value` según `dictionary`.
 * Valores vacíos → "—"; valores desconocidos → versión legible del valor.
 */
export function labelFor(
  dictionary: Dictionary,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return dictionary[value] ?? humanize(value);
}
