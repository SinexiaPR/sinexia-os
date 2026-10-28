import { createClient } from "@/lib/supabase/server";

export type AdminHomeCounts = {
  overdueInvoices: number;
  documentsToReview: number;
};

const UNPAID_STATUSES = ["issued", "sent", "viewed", "overdue"];

function todayInPuertoRico() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Conteos de solo lectura para los indicadores de Inicio. Respeta RLS; no
 * modifica estados (a diferencia de `getInvoices`, que refresca vencidas).
 */
export async function getAdminHomeCounts(): Promise<AdminHomeCounts> {
  const supabase = await createClient();
  const [overdue, documents] = await Promise.all([
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("status", UNPAID_STATUSES)
      .lt("due_date", todayInPuertoRico()),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("status", ["received", "reviewing"]),
  ]);
  if (overdue.error) throw overdue.error;
  if (documents.error) throw documents.error;
  return {
    overdueInvoices: overdue.count ?? 0,
    documentsToReview: documents.count ?? 0,
  };
}
