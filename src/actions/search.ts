"use server";

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type SearchResult = {
  id: string;
  kind: "client" | "invoice" | "document";
  title: string;
  subtitle: string;
  href: string;
};

const MAX_PER_KIND = 6;

// Quita los caracteres que tienen significado en los filtros `or()`/`ilike` de
// PostgREST para que el texto del usuario nunca altere la consulta.
function sanitize(query: string): string {
  return query
    .replace(/[%_*,()\\"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Búsqueda global de la paleta de comandos (Ctrl/Cmd + K). Solo lectura y solo
 * para administradores; el aislamiento por empresa lo sigue imponiendo RLS.
 */
export async function searchWorkspace(
  rawQuery: string,
): Promise<{ results: SearchResult[] }> {
  const profile = await requireAuth();
  if (profile.role !== "admin") return { results: [] };

  const query = sanitize(rawQuery.slice(0, 80));
  if (query.length < 2) return { results: [] };

  const supabase = await createClient();
  const pattern = `%${query}%`;
  const invoiceNumber = /^#?\d+$/.test(query)
    ? Number(query.replace("#", ""))
    : null;

  const invoiceFilter = invoiceNumber
    ? `invoice_number.eq.${invoiceNumber},billing_name_snapshot.ilike.${pattern}`
    : `billing_name_snapshot.ilike.${pattern}`;

  const [companies, invoices, documents] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name")
      .ilike("name", pattern)
      .order("name")
      .limit(MAX_PER_KIND),
    supabase
      .from("invoices")
      .select("id, invoice_number, billing_name_snapshot, total, currency")
      .or(invoiceFilter)
      .order("created_at", { ascending: false })
      .limit(MAX_PER_KIND),
    supabase
      .from("documents")
      .select(
        "id, supplier, invoice_number, document_type, company_id, company:companies(name)",
      )
      .or(
        `supplier.ilike.${pattern},invoice_number.ilike.${pattern},document_type.ilike.${pattern}`,
      )
      .order("created_at", { ascending: false })
      .limit(MAX_PER_KIND),
  ]);

  const results: SearchResult[] = [];

  for (const row of companies.data ?? []) {
    results.push({
      id: `client-${row.id}`,
      kind: "client",
      title: row.name,
      subtitle: "Cliente",
      href: `/dashboard/admin/companies/${row.id}`,
    });
  }

  for (const row of invoices.data ?? []) {
    const money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: row.currency ?? "USD",
    }).format(Number(row.total ?? 0));
    results.push({
      id: `invoice-${row.id}`,
      kind: "invoice",
      title: row.invoice_number
        ? `Factura #${row.invoice_number}`
        : "Factura en borrador",
      subtitle: `${row.billing_name_snapshot ?? "Cliente"} · ${money}`,
      href: `/dashboard/admin/invoices/${row.id}`,
    });
  }

  for (const row of documents.data ?? []) {
    const company = Array.isArray(row.company) ? row.company[0] : row.company;
    results.push({
      id: `document-${row.id}`,
      kind: "document",
      title: `${row.document_type} · ${row.supplier}`,
      subtitle: `${company?.name ?? "Empresa"} · N.º ${row.invoice_number}`,
      href: `/dashboard/inbox?company=${row.company_id}`,
    });
  }

  return { results };
}
