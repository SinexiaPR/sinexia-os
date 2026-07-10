export const assistantConfig = {
  name: "SinexIA",
  fullName: "SinexIA Document Intelligence",
  disclaimer:
    "SinexIA responde solo con base en los documentos de su empresa. Esta información es operativa y no constituye asesoría fiscal, legal ni financiera. Confirme con Sinexia cuando sea necesario.",
  suggestedPrompts: [
    "¿Qué documentos nuevos publicó Sinexia?",
    "Resumime este reporte.",
    "¿Cuál es el total pendiente por cobrar?",
    "¿Cuál es el total de la nómina de esta semana?",
  ] as const,
} as const;

export type AssistantConfig = typeof assistantConfig;
