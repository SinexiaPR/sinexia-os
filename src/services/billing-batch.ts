import { createClient } from "@/lib/supabase/server";
import type { BillingBatchClient, Invoice } from "@/types/invoices";

export async function getBillingBatchClients(): Promise<BillingBatchClient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_batch_clients")
    .select("*,companies(name,slug)")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BillingBatchClient[];
}

export type WeeklyBatchPreviewLine = {
  billingBatchClientId: string;
  companyId: string;
  companyName: string;
  lineDescription: string;
  amount: number | null;
  /** true cuando amount_type='system' y todavía no existe ningún
   * resolver automático -- no se inventa ningún número, se excluye del
   * lote hasta que la admin cargue un monto a mano o el cliente pase a
   * "fijo". */
  pendingAmount: boolean;
  periodStart: string;
  periodEnd: string;
  /** Número real solo se asigna al confirmar (issue_invoice, con lock) --
   * esto es una estimación de lectura, puede cambiar si otra factura se
   * emite entre la vista previa y la confirmación. */
  estimatedNextNumber: number | null;
  existingInvoice: { id: string; status: Invoice["status"]; invoiceNumber: number | null } | null;
};

export async function previewWeeklyInvoiceBatch(
  periodStart: string,
  periodEnd: string,
): Promise<WeeklyBatchPreviewLine[]> {
  const supabase = await createClient();
  const [clientsRes, sequenceRes] = await Promise.all([
    supabase
      .from("billing_batch_clients")
      .select("*,companies(name,slug)")
      .eq("active", true)
      .order("display_order", { ascending: true, nullsFirst: false }),
    supabase
      .from("invoice_sequences")
      .select("last_issued_number")
      .eq("sequence_key", "sinexia_global_invoice")
      .maybeSingle(),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  if (sequenceRes.error) throw sequenceRes.error;
  const clients = (clientsRes.data ?? []) as BillingBatchClient[];
  const nextNumber = (sequenceRes.data?.last_issued_number ?? null) === null
    ? null
    : sequenceRes.data!.last_issued_number + 1;

  const existingRes = await supabase
    .from("invoices")
    .select("id,status,invoice_number,billing_batch_client_id")
    .eq("billing_period_start", periodStart)
    .neq("status", "cancelled")
    .in(
      "billing_batch_client_id",
      clients.map((client) => client.id),
    );
  if (existingRes.error) throw existingRes.error;
  const existingByClient = new Map(
    (existingRes.data ?? []).map((row) => [row.billing_batch_client_id as string, row]),
  );

  // Cada línea nueva del lote consumiría un número consecutivo real al
  // confirmar -- se muestra una estimación creciente por orden de lista,
  // dejando claro en la UI que es provisional (issue_invoice es la única
  // fuente real de verdad, con su propio lock atómico).
  let runningNumber = nextNumber;
  return clients.map((client) => {
    const existing = existingByClient.get(client.id) ?? null;
    const pendingAmount = client.amount_type === "system";
    const amount = pendingAmount ? null : client.fixed_amount;
    const willConsumeNumber = !existing && !pendingAmount;
    const estimatedNextNumber = willConsumeNumber ? runningNumber : null;
    if (willConsumeNumber && runningNumber !== null) runningNumber += 1;
    return {
      billingBatchClientId: client.id,
      companyId: client.company_id,
      companyName: client.companies?.name ?? "Cliente",
      lineDescription: client.line_description,
      amount,
      pendingAmount,
      periodStart,
      periodEnd,
      estimatedNextNumber,
      existingInvoice: existing
        ? { id: existing.id, status: existing.status, invoiceNumber: existing.invoice_number }
        : null,
    };
  });
}
