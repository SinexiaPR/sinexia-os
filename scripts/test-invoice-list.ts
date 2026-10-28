import assert from "node:assert/strict";

import {
  EMPTY_INVOICE_FILTERS,
  countAdvancedFilters,
  formatMoneyByCurrency,
  filterInvoices,
  paginate,
  parseStatusFilter,
  summarizeInvoices,
} from "../src/lib/invoices/list";
import type { Invoice } from "../src/types/invoices";

function inv(partial: Partial<Invoice> & { id: string }): Invoice {
  return {
    invoice_number: 1,
    status: "issued",
    invoice_date: "2026-10-01",
    due_date: "2026-10-01",
    currency: "USD",
    total: 100,
    company_id: "c1",
    billing_name_snapshot: "Sibarita",
    email_status: null,
    paid_at: null,
    is_legacy_import: false,
    companies: { name: "Sibarita", slug: "sibarita" },
    ...partial,
  } as Invoice;
}

const invoices = [
  inv({ id: "a", invoice_number: 10, status: "overdue", total: 250.5 }),
  inv({
    id: "b",
    invoice_number: 11,
    status: "paid",
    paid_at: "2026-10-15T12:00:00Z",
    total: 100,
  }),
  inv({
    id: "c",
    invoice_number: 12,
    status: "paid",
    paid_at: "2026-09-30T12:00:00Z",
    total: 40,
  }),
  inv({
    id: "d",
    invoice_number: 13,
    status: "sent",
    total: 60,
    company_id: "c2",
    billing_name_snapshot: "Tresbe",
    email_status: "sent",
  }),
  inv({ id: "e", invoice_number: null, status: "draft", total: 5 }),
  inv({
    id: "f",
    invoice_number: 1,
    status: "overdue",
    total: 0,
    is_legacy_import: true,
    invoice_date: null,
  }),
];

// Históricas separadas de las actuales
assert.deepEqual(
  filterInvoices(invoices, EMPTY_INVOICE_FILTERS).map((i) => i.id),
  ["a", "b", "c", "d", "e"],
);
assert.deepEqual(
  filterInvoices(invoices, { ...EMPTY_INVOICE_FILTERS, historical: true }).map(
    (i) => i.id,
  ),
  ["f"],
);

// Chips de estado
const byStatus = (status: Parameters<typeof parseStatusFilter>[0]) =>
  filterInvoices(invoices, {
    ...EMPTY_INVOICE_FILTERS,
    status: parseStatusFilter(status),
  }).map((i) => i.id);
assert.deepEqual(byStatus("overdue"), ["a"]);
assert.deepEqual(byStatus("open"), ["d"]);
assert.deepEqual(byStatus("paid"), ["b", "c"]);
assert.deepEqual(byStatus("draft"), ["e"]);
assert.equal(parseStatusFilter("cualquier-cosa"), "all");
assert.equal(parseStatusFilter(undefined), "all");

// Búsqueda por número y por cliente; filtros avanzados
const search = (q: string) =>
  filterInvoices(invoices, { ...EMPTY_INVOICE_FILTERS, search: q }).map(
    (i) => i.id,
  );
assert.deepEqual(search("#13"), ["d"]);
assert.deepEqual(search("tresbe"), ["d"]);
assert.deepEqual(search("borrador"), ["e"]);
assert.deepEqual(
  filterInvoices(invoices, { ...EMPTY_INVOICE_FILTERS, email: "sent" }).map(
    (i) => i.id,
  ),
  ["d"],
);
assert.deepEqual(
  filterInvoices(invoices, { ...EMPTY_INVOICE_FILTERS, companyId: "c2" }).map(
    (i) => i.id,
  ),
  ["d"],
);
assert.equal(
  countAdvancedFilters({
    ...EMPTY_INVOICE_FILTERS,
    companyId: "c2",
    dateFrom: "2026-10-01",
  }),
  2,
);

// Resumen: ignora históricas; cobrado solo del mes en curso
const summary = summarizeInvoices(invoices, "2026-10-28");
assert.deepEqual(summary.pending, { USD: 310.5 }, "vencida + enviada");
assert.deepEqual(summary.overdue, { USD: 250.5 });
assert.equal(summary.overdueCount, 1);
assert.deepEqual(summary.collectedThisMonth, { USD: 100 });

// Paginación
const many = Array.from({ length: 60 }, (_, i) => i);
const p1 = paginate(many, 1);
assert.equal(p1.items.length, 25);
assert.equal(p1.totalPages, 3);
assert.deepEqual([p1.from, p1.to, p1.total], [1, 25, 60]);
const p3 = paginate(many, 99);
assert.equal(p3.page, 3, "se limita a la última página");
assert.deepEqual([p3.from, p3.to], [51, 60]);
assert.deepEqual(paginate([], 1), {
  items: [],
  page: 1,
  totalPages: 1,
  from: 0,
  to: 0,
  total: 0,
});

assert.equal(formatMoneyByCurrency({}), "$0.00");
assert.equal(formatMoneyByCurrency({ USD: 1234.5 }), "$1,234.50");

console.log("Invoice list filters, summary and pagination: PASS");
