export const assistantConfig = {
  name: "SinexIA",
  fullName: "SinexIA Document Intelligence",
  tagline: "Pregunte lo que quiera sobre su empresa.",
  description:
    "SinexIA analiza sus reportes financieros, nóminas, cuentas por cobrar y por pagar y demás documentos para responder con los datos reales de su empresa.",
  disclaimer:
    "SinexIA responde solo con base en los documentos de su empresa. Esta información es operativa y no constituye asesoría fiscal, legal ni financiera. Confirme con Sinexia cuando sea necesario.",
  suggestedPrompts: [
    "¿Cuánto me deben en total?",
    "Comparar con el reporte de la semana anterior.",
    "Resume esta nómina.",
    "¿Qué cambió desde la carga anterior?",
  ] as const,
} as const;

export type AssistantConfig = typeof assistantConfig;
