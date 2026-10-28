import type { DetectedDocumentType } from "@/lib/intelligence/types";

/** Preguntas sugeridas (en español) según los tipos de documento analizados. */
export function buildSuggestedQuestionsFromProfiles(
  profiles: Array<{
    document_type: DetectedDocumentType | null;
    period?: string | null;
    structured_data?: Record<string, unknown> | null;
  }>,
): string[] {
  if (!profiles.length) {
    return [
      "¿Qué documentos tengo analizados?",
      "Resume el último reporte disponible.",
    ];
  }

  const types = new Set(profiles.map((p) => p.document_type).filter(Boolean));
  const suggestions: string[] = [];

  if (types.has("payroll") || types.has("homebase_export")) {
    suggestions.push(
      "¿Cuánto es la nómina total?",
      "¿Cuántos empleados hay?",
      "¿Cuáles son las horas extra?",
      "Comparar la nómina con la semana anterior.",
    );
  }

  if (types.has("accounts_receivable") || types.has("custom_aging")) {
    suggestions.push(
      "¿Cuál es mi total por cobrar?",
      "¿Quién debe más?",
      "¿Cuántas facturas hay?",
      "¿Cuántos clientes hay?",
      "Comparar con el reporte anterior.",
    );
  }

  if (types.has("accounts_payable")) {
    suggestions.push(
      "¿Cuál es el total de cuentas por pagar?",
      "¿Cuántos proveedores hay?",
      "Comparar las cuentas por pagar con el reporte anterior.",
    );
  }

  if (types.has("profit_and_loss") || types.has("quickbooks_report")) {
    suggestions.push(
      "¿Cuáles son los ingresos?",
      "¿Cuáles son los gastos?",
      "¿Cuál es la utilidad neta?",
      "Resume este reporte financiero.",
    );
  }

  if (types.has("balance_sheet")) {
    suggestions.push(
      "¿Cuáles son los activos totales?",
      "¿Cuáles son los pasivos?",
      "¿Cuál es el patrimonio?",
    );
  }

  if (types.has("bank_reconciliation")) {
    suggestions.push(
      "¿Cuál es la diferencia de la conciliación?",
      "Comparar con la conciliación anterior.",
    );
  }

  if (types.has("bank_statement") || types.has("statement")) {
    suggestions.push(
      "¿Cuál es el saldo final?",
      "Comparar con el estado de cuenta anterior.",
    );
  }

  if (profiles.length >= 2) {
    suggestions.push(
      "¿Qué cambió desde la carga anterior?",
      "Comparar los dos últimos reportes.",
    );
  }

  suggestions.push("Resume este reporte.");

  return [...new Set(suggestions)].slice(0, 10);
}
