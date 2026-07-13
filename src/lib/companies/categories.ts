export const COMPANY_CATEGORIES = [
  { slug: "payroll", label: "Nómina" },
  { slug: "supplier-payments", label: "Pago a suplidores" },
  { slug: "invoices", label: "Facturas" },
  { slug: "receipts", label: "Recibos" },
  { slug: "bank-statements", label: "Estados bancarios" },
  { slug: "payment-receipts", label: "Comprobantes de pago" },
  { slug: "accounts-receivable", label: "Cuentas por cobrar" },
  { slug: "accounts-payable", label: "Cuentas por pagar" },
  { slug: "tax-documents", label: "Documentos contributivos" },
  { slug: "contracts", label: "Contratos" },
  { slug: "identification", label: "Identificación" },
  { slug: "other", label: "Otros" },
] as const;

export type CompanyCategorySlug = (typeof COMPANY_CATEGORIES)[number]["slug"];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCompanyCategory(value: string): CompanyCategorySlug {
  const text = normalize(value);
  if (/payroll|nomina|timesheet|homebase/.test(text)) return "payroll";
  if (
    /accounts receivable|customer balance|aging receivable|cuentas por cobrar|\baging\b/.test(
      text,
    )
  )
    return "accounts-receivable";
  if (
    /accounts payable|vendor balance|aging payable|cuentas por pagar/.test(text)
  )
    return "accounts-payable";
  if (/supplier payment|vendor payment|pago.*suplidor/.test(text))
    return "supplier-payments";
  if (/payment receipt|comprobante.*pago/.test(text)) return "payment-receipts";
  if (/bank statement|bank reconciliation|estado.*bancario/.test(text))
    return "bank-statements";
  if (/invoice|factura/.test(text)) return "invoices";
  if (/receipt|recibo/.test(text)) return "receipts";
  if (/tax|contributiv/.test(text)) return "tax-documents";
  if (/contract|contrato/.test(text)) return "contracts";
  if (/identification|identificacion|^id$/.test(text)) return "identification";
  return "other";
}

export function getCompanyCategory(slug: string) {
  return COMPANY_CATEGORIES.find((category) => category.slug === slug) ?? null;
}
