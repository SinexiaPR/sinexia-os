export const assistantConfig = {
  name: "SIA",
  fullName: "Sinexia Intelligent Assistant",
  disclaimer:
    "Esta respuesta es orientativa y debe ser confirmada por Sinexia.",
  suggestedPrompts: [
    "¿Cuántos documentos he subido?",
    "¿Cuántos documentos están pendientes?",
    "¿Qué reportes tengo disponibles?",
  ] as const,
} as const;

export type AssistantConfig = typeof assistantConfig;
