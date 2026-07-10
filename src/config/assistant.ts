export const assistantConfig = {
  name: "SinexIA",
  fullName: "SinexIA Document Intelligence",
  tagline: "Ask anything about your business.",
  description:
    "SinexIA analyzes your financial reports, payrolls, receivables, payables and operational documents to answer using your company's actual data.",
  disclaimer:
    "SinexIA responde solo con base en los documentos de su empresa. Esta información es operativa y no constituye asesoría fiscal, legal ni financiera. Confirme con Sinexia cuando sea necesario.",
  suggestedPrompts: [
    "How much is currently outstanding?",
    "Compare with last week's report.",
    "Summarize this payroll.",
    "What changed since the previous upload?",
  ] as const,
} as const;

export type AssistantConfig = typeof assistantConfig;
