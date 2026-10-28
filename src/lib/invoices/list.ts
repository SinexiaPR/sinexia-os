import type { Invoice } from "@/types/invoices";

export const INVOICE_PAGE_SIZE = 25;

export type InvoiceStatusFilter =
  "all" | "draft" | "open" | "overdue" | "paid" | "cancelled";

export const INVOICE_STATUS_FILTERS: {
  value: InvoiceStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borradores" },
  { value: "open", label: "Por cobrar" },
  { value: "overdue", label: "Vencidas" },
  { value: "paid", label: "Pagadas" },
  { value: "cancelled", label: "Canceladas" },
];

const FILTER_STATUSES: Record<
  Exclude<InvoiceStatusFilter, "all">,
  Invoice["status"][]
> = {
  draft: ["draft"],
  open: ["issued", "sent", "viewed"],
  overdue: ["overdue"],
  paid: ["paid"],
  cancelled: ["cancelled"],
};

export function parseStatusFilter(
  value: string | undefined,
): InvoiceStatusFilter {
  return INVOICE_STATUS_FILTERS.some((f) => f.value === value)
    ? (value as InvoiceStatusFilter)
    : "all";
}

export type InvoiceFilters = {
  /** false = facturas actuales; true = importadas del sistema anterior. */
  historical: boolean;
  status: InvoiceStatusFilter;
  search: string;
  companyId: string;
  email: "" | "sent" | "not_sent";
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_INVOICE_FILTERS: InvoiceFilters = {
  historical: false,
  status: "all",
  search: "",
  companyId: "",
  email: "",
  dateFrom: "",
  dateTo: "",
};

/** Cantidad de filtros avanzados activos (los de "Más filtros"). */
export function countAdvancedFilters(filters: InvoiceFilters): number {
  return [
    filters.companyId,
    filters.email,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;
}

export function filterInvoices(
  invoices: Invoice[],
  filters: InvoiceFilters,
): Invoice[] {
  const term = filters.search.trim().toLowerCase();
  return invoices.filter((invoice) => {
    if (Boolean(invoice.is_legacy_import) !== filters.historical) return false;
    if (
      filters.status !== "all" &&
      !FILTER_STATUSES[filters.status].includes(invoice.status)
    )
      return false;
    if (filters.companyId && invoice.company_id !== filters.companyId)
      return false;
    if (filters.email === "sent" && invoice.email_status !== "sent")
      return false;
    if (filters.email === "not_sent" && invoice.email_status === "sent")
      return false;
    if (filters.dateFrom && (invoice.invoice_date ?? "") < filters.dateFrom)
      return false;
    if (
      filters.dateTo &&
      (invoice.invoice_date ?? "9999-12-31") > filters.dateTo
    )
      return false;
    if (term) {
      const number = String(invoice.invoice_number ?? "borrador");
      const client = (
        invoice.billing_name_snapshot ??
        invoice.companies?.name ??
        ""
      ).toLowerCase();
      if (!number.includes(term.replace("#", "")) && !client.includes(term))
        return false;
    }
    return true;
  });
}

export type MoneyByCurrency = Record<string, number>;

export type InvoiceSummary = {
  /** Emitidas y sin pagar (incluye vencidas). */
  pending: MoneyByCurrency;
  overdue: MoneyByCurrency;
  /** Pagadas durante el mes de `today`. */
  collectedThisMonth: MoneyByCurrency;
  overdueCount: number;
};

function add(target: MoneyByCurrency, currency: string, amount: number) {
  target[currency] = Math.round(((target[currency] ?? 0) + amount) * 100) / 100;
}

/**
 * Totales de arriba de la pantalla. Se calculan solo con facturas actuales
 * (las históricas importadas no cuentan) y `today` es AAAA-MM-DD.
 */
export function summarizeInvoices(
  invoices: Invoice[],
  today: string,
): InvoiceSummary {
  const summary: InvoiceSummary = {
    pending: {},
    overdue: {},
    collectedThisMonth: {},
    overdueCount: 0,
  };
  const month = today.slice(0, 7);
  for (const invoice of invoices) {
    if (invoice.is_legacy_import) continue;
    const amount = Number(invoice.total) || 0;
    if (["issued", "sent", "viewed", "overdue"].includes(invoice.status)) {
      add(summary.pending, invoice.currency, amount);
    }
    if (invoice.status === "overdue") {
      add(summary.overdue, invoice.currency, amount);
      summary.overdueCount += 1;
    }
    if (invoice.status === "paid" && invoice.paid_at?.slice(0, 7) === month) {
      add(summary.collectedThisMonth, invoice.currency, amount);
    }
  }
  return summary;
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize = INVOICE_PAGE_SIZE,
) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    totalPages,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
  };
}

/** "$1,234.50", o varias monedas separadas por " · "; "$0.00" si no hay montos. */
export function formatMoneyByCurrency(amounts: MoneyByCurrency): string {
  const entries = Object.entries(amounts);
  if (!entries.length) return "$0.00";
  return entries
    .map(([currency, amount]) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
        amount,
      ),
    )
    .join(" · ");
}
