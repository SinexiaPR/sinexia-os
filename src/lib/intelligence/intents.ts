export type QueryIntent =
  | "payroll_total"
  | "employee_count"
  | "most_hours_worked"
  | "total_hours"
  | "overtime_hours"
  | "total_tips"
  | "service_checks_total"
  | "service_check_recipients"
  | "receivable_total"
  | "customer_count"
  | "invoice_count_receivable"
  | "top_debtors"
  | "aging_buckets"
  | "payable_total"
  | "vendor_count"
  | "invoice_count_payable"
  | "revenue"
  | "expenses"
  | "net_income"
  | "assets"
  | "liabilities"
  | "equity"
  | "bank_difference"
  | "closing_balance"
  | "comparison"
  | "summary"
  | "reasoning"
  | "unknown";

const PAYROLL_TOTAL = [
  /payroll\s*total/i,
  /total\s*payroll/i,
  /n[oó]mina\s*total/i,
  /cu[aá]nto\s*(es\s*)?(la\s*)?n[oó]mina/i,
  /what\s*is\s*my\s*payroll/i,
];
const EMPLOYEE_COUNT = [
  /how\s*many\s*employees?/i,
  /cu[aá]ntos?\s*empleados?\s*(aparecen|hay|tiene|tiene\s*la\s*n[oó]mina|en\s*(la\s*)?(n[oó]mina|planilla|hoja|archivo|reporte))?/i,
  /employee\s*count/i,
];
const MOST_HOURS = [
  /qui[eé]n\s*trabaj[oó]\s*m[aá]s\s*horas?/i,
  /who\s*worked\s*(the\s*)?most\s*hours?/i,
  /empleado\s*con\s*m[aá]s\s*horas?/i,
];
const TOTAL_HOURS = [
  /cu[aá]ntas?\s*horas?\s*(totales?|hay|trabajadas?|en\s*(la\s*)?(n[oó]mina|planilla|archivo))?/i,
  /total\s*hours?/i,
  /horas?\s*totales?/i,
];
const OVERTIME = [
  /overtime/i,
  /horas?\s*extra/i,
  /pasaron?\s*(de\s*)?40\s*horas/i,
  /m[aá]s\s*de\s*40\s*horas/i,
];
const TIPS = [/tips?/i, /propinas?/i];
const SERVICE_CHECKS = [
  /total.*cheques?\s*de\s*servicios?/i,
  /cu[aá]nto.*cheques?\s*de\s*servicios?/i,
  /service\s*checks?\s*total/i,
];
const SERVICE_RECIPIENTS = [
  /qui[eé]n.*(recibi[oó]|tiene).*cheques?\s*(por|de)\s*servicios?/i,
  /empleados?.*cheques?\s*de\s*servicios?/i,
  /who.*service\s*checks?/i,
];
const RECEIVABLE_TOTAL = [
  /total\s*receivable/i,
  /accounts?\s*receivable/i,
  /cuentas?\s*por\s*cobrar/i,
  /outstanding/i,
  /total\s*por\s*cobrar/i,
  /cu[aá]nto\s*me\s*deben?/i,
  /what\s*is\s*my\s*receivable/i,
  /grand\s*total/i,
];
const CUSTOMER_COUNT = [
  /how\s*many\s*customers?/i,
  /cu[aá]ntos?\s*clientes?/i,
  /customer\s*count/i,
  /how\s*many\s*customers?\s*exist/i,
];
const INVOICE_COUNT = [
  /how\s*many\s*invoices?/i,
  /cu[aá]ntas?\s*facturas?/i,
  /invoice\s*count/i,
  /how\s*many\s*invoices?\s*exist/i,
];
const TOP_DEBTORS = [
  /who\s*owes\s*the\s*most/i,
  /top\s*debtor/i,
  /largest\s*(customer\s*)?balance/i,
  /qui[eé]n\s*debe\s*m[aá]s/i,
  /clientes?\s*con\s*mayor/i,
];
const AGING_BUCKETS = [
  /1\s*[-–]\s*30/i,
  /31\s*[-–]\s*60/i,
  /61\s*[-–]\s*90/i,
  /90\s*\+/i,
  /aging\s*bucket/i,
  /over\s*60\s*days/i,
  /more\s*than\s*60/i,
  /vencid/i,
];
const PAYABLE_TOTAL = [
  /total\s*payable/i,
  /accounts?\s*payable/i,
  /cuentas?\s*por\s*pagar/i,
];
const VENDOR_COUNT = [/how\s*many\s*vendors?/i, /cu[aá]ntos?\s*proveedores?/i];
const REVENUE = [/revenue/i, /ingresos?/i, /ventas?/i];
const EXPENSES = [/expenses?/i, /gastos?/i];
const NET_INCOME = [/net\s*income/i, /utilidad/i];
const ASSETS = [/total\s*assets?/i, /activos?/i];
const LIABILITIES = [/liabilit/i, /pasivos?/i];
const EQUITY = [/equity/i, /patrimonio/i];
const BANK_DIFF = [/difference/i, /diferencia/i, /reconcil/i];
const CLOSING = [/closing\s*balance/i, /saldo\s*final/i];
const COMPARISON = [
  /compare/i,
  /comparar/i,
  /vs\.?/i,
  /versus/i,
  /previous/i,
  /anterior/i,
  /last\s*week/i,
  /semana\s*anterior/i,
  /what\s*changed/i,
  /qu[eé]\s*cambi[oó]/i,
];
const SUMMARY = [
  /^summarize/i,
  /^resum/i,
  /resumime/i,
  /res[uú]men/i,
  /describe/i,
  /describ/i,
  /explain/i,
  /explic/i,
  /analiz[aá]me/i,
];
const REASONING = [
  /pattern/i,
  /tendencia/i,
  /trend/i,
  /why/i,
  /por\s*qu[eé]/i,
  /biggest\s*change/i,
  /mayor\s*cambio/i,
  /last\s*four/i,
  /[uú]ltimos?\s*cuatro/i,
  /across/i,
  /recommend/i,
  /recomend/i,
  /advice/i,
  /impuesto/i,
  /tax/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function detectQueryIntent(question: string): QueryIntent {
  const q = question.trim();

  if (matchesAny(q, REASONING)) return "reasoning";
  if (matchesAny(q, SUMMARY)) return "summary";
  if (matchesAny(q, COMPARISON)) return "comparison";

  if (matchesAny(q, PAYROLL_TOTAL)) return "payroll_total";
  if (matchesAny(q, EMPLOYEE_COUNT)) return "employee_count";
  if (matchesAny(q, MOST_HOURS)) return "most_hours_worked";
  if (matchesAny(q, TOTAL_HOURS)) return "total_hours";
  if (matchesAny(q, OVERTIME)) return "overtime_hours";
  if (matchesAny(q, TIPS)) return "total_tips";
  if (matchesAny(q, SERVICE_RECIPIENTS)) return "service_check_recipients";
  if (matchesAny(q, SERVICE_CHECKS)) return "service_checks_total";

  if (matchesAny(q, RECEIVABLE_TOTAL)) return "receivable_total";
  if (matchesAny(q, TOP_DEBTORS)) return "top_debtors";
  if (matchesAny(q, AGING_BUCKETS)) return "aging_buckets";
  if (matchesAny(q, CUSTOMER_COUNT)) return "customer_count";
  if (
    matchesAny(q, INVOICE_COUNT) &&
    /payable|pagar|vendor|proveedor/i.test(q)
  ) {
    return "invoice_count_payable";
  }
  if (matchesAny(q, INVOICE_COUNT)) return "invoice_count_receivable";

  if (matchesAny(q, PAYABLE_TOTAL)) return "payable_total";
  if (matchesAny(q, VENDOR_COUNT)) return "vendor_count";

  if (matchesAny(q, REVENUE)) return "revenue";
  if (matchesAny(q, EXPENSES)) return "expenses";
  if (matchesAny(q, NET_INCOME)) return "net_income";
  if (matchesAny(q, ASSETS)) return "assets";
  if (matchesAny(q, LIABILITIES)) return "liabilities";
  if (matchesAny(q, EQUITY)) return "equity";
  if (matchesAny(q, BANK_DIFF)) return "bank_difference";
  if (matchesAny(q, CLOSING)) return "closing_balance";

  return "unknown";
}

export function requiresOpenAI(intent: QueryIntent): boolean {
  return intent === "summary" || intent === "reasoning";
}

export function normalizeQuestionForCache(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
