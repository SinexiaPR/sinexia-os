// Los dos errores de categorización que arrastraba la planilla se atajan en la
// carga: Clover es tarjeta, y el barrido de la línea de reserva no es operativo.

export type CategoryHint = {
  code: string;
  level: "sugerencia" | "obligatoria";
  reason: string;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function categoryHintFor(
  concept: string,
  counterparty: string | null | undefined,
): CategoryHint | null {
  const text = normalize(`${concept} ${counterparty ?? ""}`);
  if (
    /(fondo\s+)?transf\w*\.?\s*reserva|linea de reserva|transferencia reserva/.test(
      text,
    )
  ) {
    return {
      code: "linea_credito_utilizacion",
      level: "obligatoria",
      reason:
        "Los barridos de la línea no son ingresos operativos: van a Utilización Línea de Crédito.",
    };
  }
  if (/grupo sibarita|lado ce|intercompany/.test(text)) {
    return {
      code: "intercompany_recibido",
      level: "sugerencia",
      reason:
        "Las transferencias entre las LLC no son venta ni gasto: van a Intercompany, con contraparte.",
    };
  }
  if (/clover/.test(text)) {
    return {
      code: "credit_card_disponible",
      level: "sugerencia",
      reason:
        "Los depósitos de Clover son tarjeta: corresponden a Credit Card Disponible, no a Cash Disponible.",
    };
  }
  return null;
}
