"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { issueInvoice } from "@/actions/invoices";
import {
  previewWeeklyInvoiceBatch,
  type WeeklyBatchPreviewLine,
} from "@/services/billing-batch";

const periodSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
});

export async function getWeeklyInvoiceBatchPreview(
  periodStart: string,
  periodEnd: string,
): Promise<{ error: string } | { success: true; lines: WeeklyBatchPreviewLine[] }> {
  const parsed = periodSchema.safeParse({ periodStart, periodEnd });
  if (!parsed.success) return { error: "Periodo inválido." };
  await requireAdmin();
  try {
    const lines = await previewWeeklyInvoiceBatch(parsed.data.periodStart, parsed.data.periodEnd);
    return { success: true, lines };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo armar la vista previa." };
  }
}

const confirmLineSchema = z.object({
  billingBatchClientId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  amountOverride: z.coerce.number().positive().max(100_000_000).nullable().optional(),
  cancelInvoiceId: z.string().uuid().nullable().optional(),
});

const confirmBatchSchema = z.array(confirmLineSchema).min(1).max(200);

export type ConfirmBatchResult = {
  billingBatchClientId: string;
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: number;
  error?: string;
};

/**
 * Crea los borradores del lote en UNA transacción (todo o nada: si
 * cualquier línea choca con el anti-duplicado o con datos faltantes,
 * ninguna se crea) vía create_weekly_invoice_drafts, y después emite
 * cada una llamando a la MISMA acción issueInvoice() que ya usa el
 * flujo manual -- no se reimplementa la numeración ni la generación de
 * PDF. La emisión ya no puede deshacerse todo-o-nada (los números de
 * factura nunca se reutilizan, por diseño ya existente): si una emisión
 * puntual falla, las anteriores quedan emitidas con su número real y el
 * resultado lo marca línea por línea para que la admin reintente solo
 * las que fallaron.
 */
export async function confirmWeeklyInvoiceBatch(
  lines: unknown,
): Promise<{ error: string } | { success: true; results: ConfirmBatchResult[] }> {
  const parsed = confirmBatchSchema.safeParse(lines);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Revisa las líneas del lote." };
  await requireAdmin();
  const supabase = await createClient();

  const requests = parsed.data.map((line) => ({
    billingBatchClientId: line.billingBatchClientId,
    periodStart: line.periodStart,
    periodEnd: line.periodEnd,
    amountOverride: line.amountOverride ?? null,
    cancelInvoiceId: line.cancelInvoiceId ?? null,
  }));

  const drafted = await supabase.rpc("create_weekly_invoice_drafts", {
    p_requests: requests,
  });
  if (drafted.error) return { error: drafted.error.message };

  const draftRows = (drafted.data ?? []) as Array<{
    id: string;
    billing_batch_client_id: string;
  }>;
  const draftByClient = new Map(
    draftRows.map((row) => [row.billing_batch_client_id, row.id]),
  );

  const results: ConfirmBatchResult[] = [];
  for (const line of parsed.data) {
    const invoiceId = draftByClient.get(line.billingBatchClientId);
    if (!invoiceId) {
      results.push({
        billingBatchClientId: line.billingBatchClientId,
        success: false,
        error: "No se generó el borrador para esta línea.",
      });
      continue;
    }
    const issued = await issueInvoice(invoiceId);
    // issueInvoice puede fallar ANTES de asignar número (la factura
    // sigue en borrador, se puede reintentar) o DESPUÉS, solo en la
    // generación del PDF (el número real ya quedó asignado y no se
    // puede deshacer -- eso es correcto, nunca se reutilizan números).
    if (issued.invoiceNumber == null) {
      results.push({
        billingBatchClientId: line.billingBatchClientId,
        success: false,
        invoiceId,
        error: "error" in issued ? issued.error : "No se pudo emitir la factura.",
      });
      continue;
    }
    results.push({
      billingBatchClientId: line.billingBatchClientId,
      success: true,
      invoiceId,
      invoiceNumber: issued.invoiceNumber,
      ...("error" in issued ? { error: issued.error } : {}),
    });
  }

  revalidatePath("/dashboard/admin/invoices");
  revalidatePath("/dashboard/admin/invoices/batch");
  return { success: true, results };
}

const billingClientSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  amountType: z.enum(["fixed", "system"]),
  fixedAmount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  lineDescription: z.string().trim().min(1).max(500),
  active: z.boolean(),
  displayOrder: z.coerce.number().int().nullable().optional(),
});

export async function saveBillingBatchClient(
  input: unknown,
): Promise<{ error: string } | { success: true }> {
  const parsed = billingClientSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del cliente." };
  const value = parsed.data;
  if (value.amountType === "fixed" && (value.fixedAmount == null || value.fixedAmount <= 0))
    return { error: "Un cliente con monto fijo necesita un monto mayor a 0." };
  await requireAdmin();
  const supabase = await createClient();

  const row = {
    company_id: value.companyId,
    amount_type: value.amountType,
    fixed_amount: value.amountType === "fixed" ? value.fixedAmount : null,
    line_description: value.lineDescription,
    active: value.active,
    display_order: value.displayOrder ?? null,
  };

  const result = value.id
    ? await supabase.from("billing_batch_clients").update(row).eq("id", value.id)
    : await supabase.from("billing_batch_clients").insert(row);
  if (result.error) return { error: result.error.message };
  revalidatePath("/dashboard/admin/invoices/billing-clients");
  revalidatePath("/dashboard/admin/invoices/batch");
  return { success: true };
}

export async function setBillingBatchClientActive(
  id: string,
  active: boolean,
): Promise<{ error: string } | { success: true }> {
  const parsed = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse({ id, active });
  if (!parsed.success) return { error: "Solicitud inválida." };
  await requireAdmin();
  const supabase = await createClient();
  const result = await supabase
    .from("billing_batch_clients")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id);
  if (result.error) return { error: result.error.message };
  revalidatePath("/dashboard/admin/invoices/billing-clients");
  revalidatePath("/dashboard/admin/invoices/batch");
  return { success: true };
}
