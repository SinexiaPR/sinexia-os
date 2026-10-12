// Extracción de texto de los PDF de entrada de "Informes diarios" (Cut
// Meat Distributors). Reutiliza extractPdf() (pdf-parse) para el texto y
// el parser de "Balance Detail" de QuickBooks para los dos aging
// (Vendor Balance Detail y Customer Balance Detail comparten formato).
//
// Estos son extractores "mejor esfuerzo": el administrador siempre
// revisa y puede corregir cada campo antes de guardar -- por eso no
// lanzan error si algo no matchea, devuelven null/[] y dejan que la
// pantalla pida el dato a mano.

import { parseMoney, findLabeledAmount } from "@/lib/intelligence/extractors/base";
import {
  extractGrandTotalFromPdfText,
  parseCustomerBalanceDetailPdfText,
} from "@/lib/intelligence/extractors/quickbooks-ar-pdf";

export type ExtractedReconciliationItem = {
  reference: string;
  amount: number;
};

export type ExtractedReconciliation = {
  statementEnding: number | null;
  register: number | null;
  unclearedChecks: ExtractedReconciliationItem[];
  unclearedDeposits: ExtractedReconciliationItem[];
};

function extractUnclearedItems(
  text: string,
  sectionLabel: RegExp,
): ExtractedReconciliationItem[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const items: ExtractedReconciliationItem[] = [];
  let inSection = false;
  for (const line of lines) {
    if (sectionLabel.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^total\b/i.test(line)) {
      inSection = false;
      continue;
    }
    // Línea de detalle: termina en un monto, con o sin signo/paréntesis.
    const match = line.match(/(.+?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?)\s*$/);
    if (!match) continue;
    const amount = parseMoney(match[2]);
    const reference = match[1].trim();
    if (amount == null || !reference || /^(date|type|num|memo)/i.test(reference))
      continue;
    items.push({ reference, amount });
  }
  return items;
}

/**
 * QuickBooks Reconciliation Report (FIRST BANK). El layout exacto varía
 * según la versión de QuickBooks; esto busca las etiquetas estándar del
 * reporte de conciliación y dos secciones de pendientes (cheques y
 * depósitos sin aclarar).
 */
export function extractReconciliationReport(text: string): ExtractedReconciliation {
  const statementEnding = findLabeledAmount(text, [
    /statement\s*ending\s*balance/i,
    /ending\s*balance/i,
  ]);
  const register = findLabeledAmount(text, [
    /register\s*balance\s*as\s*of/i,
    /register\s*balance/i,
    /cleared\s*balance/i,
  ]);
  const unclearedChecks = extractUnclearedItems(
    text,
    /uncleared\s*checks?(\s*and\s*payments?)?/i,
  );
  const unclearedDeposits = extractUnclearedItems(
    text,
    /uncleared\s*deposits?(\s*and\s*credits?)?/i,
  );
  return { statementEnding, register, unclearedChecks, unclearedDeposits };
}

export type ExtractedBankMovement = {
  description: string;
  amount: number;
  /** Mejor esfuerzo; el administrador confirma en pantalla. */
  direction: "ingreso" | "egreso";
};

export type ExtractedBankExport = {
  closingBalance: number | null;
  movements: ExtractedBankMovement[];
};

const CREDIT_HINTS = /deposit|credit|refund|ach\s*credit/i;

/**
 * Export del banco (Deposit Accounts Activity Summary). Busca líneas con
 * fecha + descripción + un monto final; clasifica ingreso/egreso por
 * palabras clave como primera aproximación -- se revisa en pantalla.
 */
export function extractBankExport(text: string): ExtractedBankExport {
  const closingBalance = findLabeledAmount(text, [
    /ending\s*balance/i,
    /closing\s*balance/i,
    /new\s*balance/i,
  ]);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const movements: ExtractedBankMovement[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+(.+?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?)\s*(\(?-?\$?[\d,]+\.\d{2}\)?)?\s*$/,
    );
    if (!match) continue;
    const description = match[1].trim();
    // Si hay dos montos, el último es el saldo corrido; el movimiento es
    // el primero.
    const amount = parseMoney(match[2]);
    if (amount == null || !description) continue;
    movements.push({
      description,
      amount: Math.abs(amount),
      direction: CREDIT_HINTS.test(description) ? "ingreso" : "egreso",
    });
  }
  return { closingBalance, movements };
}

export type ExtractedAgingLine = { name: string; balance: number };

export type ExtractedAging = {
  rawTotal: number | null;
  items: ExtractedAgingLine[];
};

/**
 * Vendor Balance Detail Report y Customer Balance Detail Report de
 * QuickBooks comparten el mismo formato de "Balance Detail" (nombre,
 * facturas, "Total for X", TOTAL general); se reutiliza el parser que
 * ya existe para SinexIA en vez de duplicar la lógica de líneas.
 */
export function extractAgingBalanceDetail(text: string): ExtractedAging {
  const { customers, grandTotal } = parseCustomerBalanceDetailPdfText(text);
  if (customers.length) {
    return {
      rawTotal: grandTotal,
      items: customers.map((c) => ({ name: c.name, balance: c.balance })),
    };
  }
  // El parser exige el encabezado "Transaction Type"; si el PDF no lo
  // trae (p.ej. un resumen sin detalle de facturas), al menos se intenta
  // sacar el total general.
  return { rawTotal: extractGrandTotalFromPdfText(text), items: [] };
}
