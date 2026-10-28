import assert from "node:assert/strict";

import { assistantConfig } from "../src/config/assistant";
import { detectQueryIntent } from "../src/lib/intelligence/intents";
import { buildSuggestedQuestionsFromProfiles } from "../src/lib/intelligence/suggestions";

// Cada pregunta sugerida en español debe activar la misma intención que su
// versión original en inglés: el motor responde igual, solo cambia el idioma.
const pairs: [string, string][] = [
  ["How much is currently outstanding?", "¿Cuánto me deben en total?"],
  [
    "Compare with last week's report.",
    "Comparar con el reporte de la semana anterior.",
  ],
  ["Summarize this payroll.", "Resume esta nómina."],
  [
    "What changed since the previous upload?",
    "¿Qué cambió desde la carga anterior?",
  ],
  ["What is the payroll total?", "¿Cuánto es la nómina total?"],
  ["How many employees?", "¿Cuántos empleados hay?"],
  ["How many overtime hours?", "¿Cuáles son las horas extra?"],
  [
    "Compare payroll with previous week.",
    "Comparar la nómina con la semana anterior.",
  ],
  ["What is my total receivable?", "¿Cuál es mi total por cobrar?"],
  ["Who owes the most?", "¿Quién debe más?"],
  ["How many invoices exist?", "¿Cuántas facturas hay?"],
  ["How many customers exist?", "¿Cuántos clientes hay?"],
  ["Compare with previous report.", "Comparar con el reporte anterior."],
  ["Total payables", "¿Cuál es el total de cuentas por pagar?"],
  ["How many vendors?", "¿Cuántos proveedores hay?"],
  [
    "Compare this AP aging with the previous report.",
    "Comparar las cuentas por pagar con el reporte anterior.",
  ],
  ["What is revenue?", "¿Cuáles son los ingresos?"],
  ["What are expenses?", "¿Cuáles son los gastos?"],
  ["What is net income?", "¿Cuál es la utilidad neta?"],
  ["Summarize this financial report.", "Resume este reporte financiero."],
  ["What are total assets?", "¿Cuáles son los activos totales?"],
  ["What are liabilities?", "¿Cuáles son los pasivos?"],
  ["What is equity?", "¿Cuál es el patrimonio?"],
  [
    "What is the reconciliation difference?",
    "¿Cuál es la diferencia de la conciliación?",
  ],
  [
    "Compare with previous reconciliation.",
    "Comparar con la conciliación anterior.",
  ],
  ["What is the closing balance?", "¿Cuál es el saldo final?"],
  [
    "Compare with previous statement.",
    "Comparar con el estado de cuenta anterior.",
  ],
  ["Compare the last two reports.", "Comparar los dos últimos reportes."],
  ["Summarize this report.", "Resume este reporte."],
];

for (const [english, spanish] of pairs) {
  assert.equal(
    detectQueryIntent(spanish),
    detectQueryIntent(english),
    `"${spanish}" debe activar la misma intención que "${english}"`,
  );
  assert.notEqual(detectQueryIntent(spanish), "unknown", spanish);
}

// El generador ya no produce frases en inglés
const types = [
  "payroll",
  "accounts_receivable",
  "accounts_payable",
  "profit_and_loss",
  "balance_sheet",
  "bank_reconciliation",
  "bank_statement",
] as const;
const generated = buildSuggestedQuestionsFromProfiles([
  ...types.map((document_type) => ({ document_type })),
  { document_type: "payroll" },
] as never);
const known = new Set(pairs.map(([, spanish]) => spanish));
for (const question of buildSuggestedQuestionsFromProfiles(
  types.map((document_type) => ({ document_type })) as never,
)) {
  assert.ok(known.has(question), `sugerencia sin traducir: ${question}`);
}
assert.ok(generated.length > 0);
for (const prompt of assistantConfig.suggestedPrompts) {
  assert.ok(known.has(prompt), `prompt sin traducir: ${prompt}`);
}
assert.ok(
  !buildSuggestedQuestionsFromProfiles([]).join(" ").includes("Resumime"),
);

console.log("SinexIA suggestions (español, misma intención): PASS");
