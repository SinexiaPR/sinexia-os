"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buildInvoicePdf } from "@/lib/invoices/pdf";
import {
  isInvoiceEmailConfigured,
  sendInvoiceEmail,
} from "@/lib/invoices/email";
import { requireAdmin, requireAuth } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBillingSettings, getInvoice } from "@/services/invoices";

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(100_000_000),
});

const invoiceDraftSchema = z
  .object({
    invoiceId: z.string().uuid().optional(),
    companyId: z.string().uuid(),
    invoiceDate: z.string().date(),
    dueDate: z.string().date(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/),
    billingName: z.string().trim().min(1).max(250),
    billingContact: optionalText(250),
    billingEmail: z.string().trim().email().nullable().optional(),
    billingCc: optionalText(500),
    billingAddress: optionalText(1000),
    language: z.enum(["es", "en"]),
    purchaseOrderReference: optionalText(200),
    clientNote: optionalText(2000),
    internalNote: optionalText(2000),
    discountType: z.enum(["none", "fixed", "percentage"]),
    discountValue: z.coerce.number().min(0),
    taxRate: z.coerce.number().min(0).max(100),
    items: z.array(invoiceItemSchema).min(1).max(100),
  })
  .refine((value) => value.dueDate >= value.invoiceDate, {
    message: "La fecha de vencimiento no puede ser anterior a la factura.",
    path: ["dueDate"],
  })
  .refine(
    (value) =>
      value.discountType !== "percentage" || value.discountValue <= 100,
    { message: "El descuento porcentual no puede exceder 100%." },
  );

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>;

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type InvoiceDatabaseError = { code?: string; message?: string };

function invoiceSaveDatabaseError(params: {
  error: InvoiceDatabaseError;
  invoiceId?: string;
  userId: string;
  operation: string;
}) {
  const message = params.error.message ?? "Database error";
  const isCalculationError =
    params.operation === "recalculate_invoice_totals" ||
    message.includes("recalculate_invoice_totals") ||
    (message.includes("permission denied") && message.includes("function"));
  console.error("Invoice draft database operation failed", {
    invoice_id: params.invoiceId ?? null,
    authenticated_user_id: params.userId,
    function_called: isCalculationError
      ? "public.recalculate_invoice_totals(uuid)"
      : null,
    postgres_error_code: params.error.code ?? null,
    postgres_message: message,
    operation: params.operation,
  });
  return isCalculationError
    ? "No se pudieron calcular los totales de la factura. Verifique los conceptos e intente nuevamente."
    : "No se pudo guardar la factura. Verifique los datos e intente nuevamente.";
}

async function addInvoiceEvent(
  invoiceId: string,
  userId: string,
  eventType: string,
  details: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  await admin.from("invoice_events").insert({
    invoice_id: invoiceId,
    user_id: userId,
    event_type: eventType,
    details,
  });
}

export async function saveInvoiceDraft(input: InvoiceDraftInput) {
  const parsed = invoiceDraftSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Revisa la factura." };
  const profile = await requireAdmin();
  const supabase = await createClient();
  const value = parsed.data;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", value.companyId)
    .maybeSingle();
  if (companyError || !company) return { error: "Cliente no válido." };

  const header = {
    company_id: value.companyId,
    invoice_date: value.invoiceDate,
    due_date: value.dueDate,
    currency: value.currency,
    billing_name_snapshot: value.billingName,
    billing_contact_snapshot: nullable(value.billingContact),
    billing_email_snapshot: nullable(value.billingEmail),
    billing_cc_snapshot: nullable(value.billingCc),
    billing_address_snapshot: nullable(value.billingAddress),
    language: value.language,
    purchase_order_reference: nullable(value.purchaseOrderReference),
    client_note: nullable(value.clientNote),
    discount_type: value.discountType,
    discount_value: value.discountValue,
    tax_rate: value.taxRate,
    updated_by: profile.id,
  };

  let invoiceId = value.invoiceId;
  if (invoiceId) {
    const existing = await supabase
      .from("invoices")
      .select("id,status")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!existing.data || existing.data.status !== "draft")
      return { error: "Solo se pueden editar borradores." };
    const update = await supabase
      .from("invoices")
      .update(header)
      .eq("id", invoiceId);
    if (update.error)
      return {
        error: invoiceSaveDatabaseError({
          error: update.error,
          invoiceId,
          userId: profile.id,
          operation: "update_invoice_header",
        }),
      };
    const deleted = await supabase
      .from("invoice_items")
      .delete()
      .eq("invoice_id", invoiceId);
    if (deleted.error)
      return {
        error: invoiceSaveDatabaseError({
          error: deleted.error,
          invoiceId,
          userId: profile.id,
          operation: "delete_invoice_items",
        }),
      };
  } else {
    const inserted = await supabase
      .from("invoices")
      .insert({ ...header, created_by: profile.id })
      .select("id")
      .single();
    if (inserted.error)
      return {
        error: invoiceSaveDatabaseError({
          error: inserted.error,
          userId: profile.id,
          operation: "insert_invoice_header",
        }),
      };
    invoiceId = inserted.data.id;
  }

  const savedAdminDetails = await supabase.from("invoice_admin_details").upsert(
    {
      invoice_id: invoiceId!,
      internal_note: nullable(value.internalNote),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "invoice_id" },
  );
  if (savedAdminDetails.error) {
    if (!value.invoiceId)
      await supabase.from("invoices").delete().eq("id", invoiceId!);
    return { error: savedAdminDetails.error.message };
  }

  const items = value.items.map((item, position) => ({
    invoice_id: invoiceId!,
    position,
    quantity: item.quantity,
    description: item.description,
    unit_price: item.unitPrice,
  }));
  const insertedItems = await supabase.from("invoice_items").insert(items);
  if (insertedItems.error) {
    if (!value.invoiceId)
      await supabase.from("invoices").delete().eq("id", invoiceId!);
    return {
      error: invoiceSaveDatabaseError({
        error: insertedItems.error,
        invoiceId,
        userId: profile.id,
        operation: "insert_invoice_items",
      }),
    };
  }
  const recalculated = await supabase.rpc("recalculate_invoice_totals", {
    value: invoiceId!,
  });
  if (recalculated.error)
    return {
      error: invoiceSaveDatabaseError({
        error: recalculated.error,
        invoiceId,
        userId: profile.id,
        operation: "recalculate_invoice_totals",
      }),
    };
  await addInvoiceEvent(
    invoiceId!,
    profile.id,
    value.invoiceId ? "draft_edited" : "draft_created",
  );
  revalidatePath("/dashboard/admin/invoices");
  revalidatePath(`/dashboard/admin/invoices/${invoiceId}`);
  return { success: true, invoiceId };
}

export async function generateInvoicePdf(invoiceId: string) {
  const profile = await requireAdmin();
  const { invoice, items } = await getInvoice(invoiceId);
  const settings = await getBillingSettings();
  if (!invoice || invoice.status === "draft" || !invoice.invoice_number)
    return { error: "La factura debe estar emitida." };
  if (!settings) return { error: "Configura los datos del emisor." };
  if (invoice.pdf_storage_path) return { success: true };
  try {
    const admin = createAdminClient();
    const downloadAsset = async (path: string | null) => {
      if (!path) return undefined;
      const downloaded = await admin.storage.from("invoices").download(path);
      if (downloaded.error) throw downloaded.error;
      return new Uint8Array(await downloaded.data.arrayBuffer());
    };
    const [logoBytes, signatureBytes] = await Promise.all([
      downloadAsset(settings.logo_storage_path),
      downloadAsset(settings.signature_storage_path),
    ]);
    const bytes = await buildInvoicePdf({
      invoice,
      items,
      settings,
      logoBytes,
      signatureBytes,
    });
    const safeCompany = (invoice.companies?.slug || "cliente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase();
    const filename = `FACTURA-${invoice.invoice_number}-${safeCompany}.pdf`;
    const path = `${invoice.company_id}/${invoice.id}/${filename}`;
    const uploaded = await admin.storage.from("invoices").upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const supabase = await createClient();
    const updated = await supabase
      .from("invoices")
      .update({ pdf_storage_path: path, updated_by: profile.id })
      .eq("id", invoice.id)
      .is("pdf_storage_path", null);
    if (updated.error) throw updated.error;
    await addInvoiceEvent(invoice.id, profile.id, "pdf_generated", { path });
    revalidatePath(`/dashboard/admin/invoices/${invoice.id}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Factura emitida, pero el PDF no pudo generarse: ${error.message}`
          : "Factura emitida, pero el PDF no pudo generarse.",
    };
  }
}

export async function issueInvoice(invoiceId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", {
    p_invoice_id: invoiceId,
  });
  if (error) return { error: error.message };
  const pdfResult = await generateInvoicePdf(invoiceId);
  if (pdfResult.error)
    return {
      error: pdfResult.error,
      issued: true,
      invoiceNumber: data as number,
    };
  revalidatePath("/dashboard/admin/invoices");
  return { success: true, invoiceNumber: data as number };
}

export async function deleteInvoiceDraft(invoiceId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("status", "draft");
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/invoices");
  redirect("/dashboard/admin/invoices");
}

export async function duplicateInvoice(invoiceId: string) {
  const profile = await requireAdmin();
  const { invoice, items } = await getInvoice(invoiceId);
  if (!invoice) return { error: "Factura no encontrada." };
  const supabase = await createClient();
  const inserted = await supabase
    .from("invoices")
    .insert({
      company_id: invoice.company_id,
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      currency: invoice.currency,
      discount_type: invoice.discount_type,
      discount_value: invoice.discount_value,
      tax_rate: invoice.tax_rate,
      billing_name_snapshot: invoice.billing_name_snapshot,
      billing_contact_snapshot: invoice.billing_contact_snapshot,
      billing_email_snapshot: invoice.billing_email_snapshot,
      billing_cc_snapshot: invoice.billing_cc_snapshot,
      billing_address_snapshot: invoice.billing_address_snapshot,
      language: invoice.language,
      client_note: invoice.client_note,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();
  if (inserted.error) return { error: inserted.error.message };
  const copied = await supabase.from("invoice_items").insert(
    items.map((item) => ({
      invoice_id: inserted.data.id,
      position: item.position,
      quantity: item.quantity,
      description: item.description,
      unit_price: item.unit_price,
    })),
  );
  if (copied.error) return { error: copied.error.message };
  await addInvoiceEvent(inserted.data.id, profile.id, "duplicated", {
    source_invoice_id: invoice.id,
  });
  revalidatePath("/dashboard/admin/invoices");
  return { success: true, invoiceId: inserted.data.id };
}

export async function markInvoicePaid(invoiceId: string, reference?: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: profile.id,
      payment_reference: nullable(reference),
      updated_by: profile.id,
    })
    .eq("id", invoiceId)
    .in("status", ["issued", "sent", "viewed", "overdue"]);
  if (error) return { error: error.message };
  await addInvoiceEvent(invoiceId, profile.id, "marked_paid", {
    reference: nullable(reference),
  });
  revalidatePath(`/dashboard/admin/invoices/${invoiceId}`);
  return { success: true };
}

export async function cancelInvoice(invoiceId: string, reason: string) {
  const parsedReason = z.string().trim().min(5).max(500).safeParse(reason);
  if (!parsedReason.success)
    return { error: "Indica el motivo de cancelación." };
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
      cancellation_reason: parsedReason.data,
      updated_by: profile.id,
    })
    .eq("id", invoiceId)
    .in("status", ["issued", "sent", "viewed", "overdue"]);
  if (error) return { error: error.message };
  await addInvoiceEvent(invoiceId, profile.id, "cancelled", {
    reason: parsedReason.data,
  });
  revalidatePath(`/dashboard/admin/invoices/${invoiceId}`);
  return { success: true };
}

const emailSchema = z.object({
  invoiceId: z.string().uuid(),
  recipient: z.string().trim().email(),
  cc: z.string().trim().max(500).nullable().optional(),
  subject: z.string().trim().min(1).max(300),
  message: z.string().trim().min(1).max(5000),
});

export async function emailInvoice(input: z.infer<typeof emailSchema>) {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Revisa destinatario, asunto y mensaje." };
  const profile = await requireAdmin();
  const { invoice } = await getInvoice(parsed.data.invoiceId);
  const settings = await getBillingSettings();
  if (!invoice || !invoice.invoice_number || !invoice.pdf_storage_path)
    return { error: "La factura emitida debe tener un PDF final." };
  if (["draft", "cancelled"].includes(invoice.status))
    return { error: "Esta factura no puede enviarse." };
  const admin = createAdminClient();
  const baseDelivery = {
    invoice_id: invoice.id,
    recipient: parsed.data.recipient,
    cc: nullable(parsed.data.cc),
    subject: parsed.data.subject,
    message: parsed.data.message,
    sent_by: profile.id,
  };
  if (!isInvoiceEmailConfigured()) {
    await admin.from("invoice_email_deliveries").insert({
      ...baseDelivery,
      delivery_status: "not_configured",
      error_message: "Proveedor de correo no configurado.",
    });
    await admin
      .from("invoices")
      .update({ email_status: "not_configured" })
      .eq("id", invoice.id);
    return { error: "Proveedor de correo no configurado." };
  }
  const downloaded = await admin.storage
    .from("invoices")
    .download(invoice.pdf_storage_path);
  if (downloaded.error) return { error: downloaded.error.message };
  try {
    const result = await sendInvoiceEmail({
      to: parsed.data.recipient,
      cc: parsed.data.cc,
      subject: parsed.data.subject,
      text: parsed.data.message,
      filename:
        invoice.pdf_storage_path.split("/").pop() ||
        `FACTURA-${invoice.invoice_number}.pdf`,
      pdf: new Uint8Array(await downloaded.data.arrayBuffer()),
      replyTo: settings?.reply_to_email,
      senderName: settings?.email_sender_name,
    });
    const sentAt = new Date().toISOString();
    await admin.from("invoice_email_deliveries").insert({
      ...baseDelivery,
      delivery_status: "sent",
      provider: "configured_http_provider",
      provider_message_id: result.messageId,
      sent_at: sentAt,
    });
    await admin
      .from("invoices")
      .update({
        status: invoice.status === "issued" ? "sent" : invoice.status,
        email_status: "sent",
        sent_at: sentAt,
        sent_by: profile.id,
      })
      .eq("id", invoice.id);
    await addInvoiceEvent(invoice.id, profile.id, "email_sent", {
      recipient: parsed.data.recipient,
      provider_message_id: result.messageId,
    });
    revalidatePath(`/dashboard/admin/invoices/${invoice.id}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de correo";
    await admin.from("invoice_email_deliveries").insert({
      ...baseDelivery,
      delivery_status: "failed",
      error_message: message.slice(0, 2000),
    });
    await admin
      .from("invoices")
      .update({ email_status: "failed" })
      .eq("id", invoice.id);
    await addInvoiceEvent(invoice.id, profile.id, "email_failed", {
      recipient: parsed.data.recipient,
      error: message.slice(0, 500),
    });
    return { error: message };
  }
}

export async function markInvoiceViewed(invoiceId: string) {
  const profile = await requireAuth();
  if (profile.role !== "client") return;
  const supabase = await createClient();
  await supabase.rpc("mark_invoice_viewed", { p_invoice_id: invoiceId });
  revalidatePath("/dashboard/invoices");
}

const billingSettingsSchema = z.object({
  issuerLegalName: optionalText(250),
  issuerDisplayName: z.string().trim().min(1).max(250),
  addressLine1: optionalText(250),
  addressLine2: optionalText(250),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(30),
  contactEmail: z.string().trim().email().nullable().optional(),
  phone: optionalText(50),
  paymentMethodLabel: optionalText(250),
  bankAccountName: optionalText(250),
  bankAccountNumber: optionalText(250),
  routingNumber: optionalText(250),
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  defaultFooter: optionalText(1000),
  signatureText: optionalText(500),
  emailSenderName: optionalText(250),
  replyToEmail: z.string().trim().email().nullable().optional(),
});

export async function saveBillingSettings(
  input: z.infer<typeof billingSettingsSchema>,
) {
  const parsed = billingSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Revisa la configuración de facturación." };
  const profile = await requireAdmin();
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("billing_settings").upsert(
    {
      settings_key: "sinexia",
      issuer_legal_name: nullable(value.issuerLegalName),
      issuer_display_name: value.issuerDisplayName,
      address_line_1: nullable(value.addressLine1),
      address_line_2: nullable(value.addressLine2),
      city: nullable(value.city),
      region: nullable(value.region),
      postal_code: nullable(value.postalCode),
      contact_email: nullable(value.contactEmail),
      phone: nullable(value.phone),
      payment_method_label: nullable(value.paymentMethodLabel),
      bank_account_name: nullable(value.bankAccountName),
      bank_account_number: nullable(value.bankAccountNumber),
      routing_number: nullable(value.routingNumber),
      default_currency: value.defaultCurrency,
      default_tax_rate: value.defaultTaxRate,
      default_footer: nullable(value.defaultFooter),
      signature_text: nullable(value.signatureText),
      email_sender_name: nullable(value.emailSenderName),
      reply_to_email: nullable(value.replyToEmail),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "settings_key" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/settings/billing");
  return { success: true };
}

export async function uploadBillingAsset(formData: FormData) {
  await requireAdmin();
  const kind = String(formData.get("kind") || "");
  const file = formData.get("file");
  if (kind !== "logo" && kind !== "signature")
    return { error: "Tipo de imagen no válido." };
  if (!(file instanceof File) || file.size === 0)
    return { error: "Selecciona una imagen." };
  if (!["image/png", "image/jpeg"].includes(file.type))
    return { error: "Usa una imagen PNG o JPG." };
  if (file.size > 2 * 1024 * 1024)
    return { error: "La imagen no puede superar 2 MB." };

  const settings = await getBillingSettings();
  const previousPath =
    kind === "logo"
      ? settings?.logo_storage_path
      : settings?.signature_storage_path;
  const extension = file.type === "image/png" ? "png" : "jpg";
  const path = `_billing/${kind}-${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const uploaded = await admin.storage
    .from("invoices")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (uploaded.error) return { error: uploaded.error.message };

  const supabase = await createClient();
  const column =
    kind === "logo" ? "logo_storage_path" : "signature_storage_path";
  const updated = await supabase
    .from("billing_settings")
    .update({ [column]: path, updated_at: new Date().toISOString() })
    .eq("settings_key", "sinexia");
  if (updated.error) {
    await admin.storage.from("invoices").remove([path]);
    return { error: updated.error.message };
  }
  if (previousPath) await admin.storage.from("invoices").remove([previousPath]);
  revalidatePath("/dashboard/admin/settings/billing");
  return { success: true };
}

const companyBillingSchema = z.object({
  companyId: z.string().uuid(),
  invoicesEnabled: z.boolean(),
  billingLegalName: optionalText(250),
  billingContactName: optionalText(250),
  billingEmail: z.string().trim().email().nullable().optional(),
  billingCc: optionalText(500),
  addressLine1: optionalText(250),
  addressLine2: optionalText(250),
  city: optionalText(120),
  region: optionalText(120),
  postalCode: optionalText(30),
  defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365),
  defaultLanguage: z.enum(["es", "en"]),
  defaultNote: optionalText(2000),
  defaultInvoiceItems: z.array(invoiceItemSchema).max(50),
});

export async function saveCompanyBillingProfile(
  input: z.infer<typeof companyBillingSchema>,
) {
  const parsed = companyBillingSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del cliente." };
  const profile = await requireAdmin();
  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("company_billing_profiles").upsert(
    {
      company_id: value.companyId,
      invoices_enabled: value.invoicesEnabled,
      billing_legal_name: nullable(value.billingLegalName),
      billing_contact_name: nullable(value.billingContactName),
      billing_email: nullable(value.billingEmail),
      billing_cc: nullable(value.billingCc),
      address_line_1: nullable(value.addressLine1),
      address_line_2: nullable(value.addressLine2),
      city: nullable(value.city),
      region: nullable(value.region),
      postal_code: nullable(value.postalCode),
      default_payment_terms_days: value.defaultPaymentTermsDays,
      default_language: value.defaultLanguage,
      default_note: nullable(value.defaultNote),
      default_invoice_items: value.defaultInvoiceItems,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/settings/billing");
  revalidatePath("/dashboard/admin/invoices/new");
  return { success: true };
}

const recurringSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  name: z.string().trim().min(1).max(250),
  frequency: z.enum(["weekly", "biweekly", "monthly", "custom"]),
  weekday: z.coerce.number().int().min(0).max(6).nullable().optional(),
  nextGenerationDate: z.string().date().nullable().optional(),
  defaultItems: z.array(invoiceItemSchema).min(1).max(50),
  defaultTermsDays: z.coerce.number().int().min(0).max(365),
  billingEmail: z.string().trim().email().nullable().optional(),
  enabled: z.boolean(),
});

export async function saveRecurringInvoiceProfile(
  input: z.infer<typeof recurringSchema>,
) {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa el perfil recurrente." };
  const profile = await requireAdmin();
  const value = parsed.data;
  const supabase = await createClient();
  const values = {
    company_id: value.companyId,
    name: value.name,
    frequency: value.frequency,
    weekday: value.weekday ?? null,
    next_generation_date: value.nextGenerationDate ?? null,
    default_items: value.defaultItems,
    default_terms_days: value.defaultTermsDays,
    billing_email: nullable(value.billingEmail),
    enabled: value.enabled,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  };
  const result = value.id
    ? await supabase
        .from("recurring_invoice_profiles")
        .update(values)
        .eq("id", value.id)
    : await supabase.from("recurring_invoice_profiles").insert({
        ...values,
        created_by: profile.id,
      });
  if (result.error) return { error: result.error.message };
  revalidatePath("/dashboard/admin/invoices");
  return { success: true };
}

export async function createInvoiceFromRecurringProfile(recurringId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: recurring }, { data: settings }] = await Promise.all([
    supabase
      .from("recurring_invoice_profiles")
      .select("*")
      .eq("id", recurringId)
      .eq("enabled", true)
      .maybeSingle(),
    supabase
      .from("billing_settings")
      .select("default_currency,default_tax_rate")
      .eq("settings_key", "sinexia")
      .maybeSingle(),
  ]);
  if (!recurring) return { error: "Perfil recurrente no disponible." };
  const [{ data: company }, { data: billing }] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name")
      .eq("id", recurring.company_id)
      .single(),
    supabase
      .from("company_billing_profiles")
      .select("*")
      .eq("company_id", recurring.company_id)
      .maybeSingle(),
  ]);
  if (!company) return { error: "Cliente no disponible." };
  const invoiceDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const due = new Date(`${invoiceDate}T12:00:00Z`);
  due.setUTCDate(due.getUTCDate() + Number(recurring.default_terms_days ?? 15));
  const address = [
    billing?.address_line_1,
    billing?.address_line_2,
    [billing?.city, billing?.region, billing?.postal_code]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");
  return saveInvoiceDraft({
    companyId: company.id,
    invoiceDate,
    dueDate: due.toISOString().slice(0, 10),
    currency: recurring.default_currency ?? settings?.default_currency ?? "USD",
    billingName: billing?.billing_legal_name ?? company.name,
    billingContact: billing?.billing_contact_name ?? null,
    billingEmail: recurring.billing_email ?? billing?.billing_email ?? null,
    billingCc: billing?.billing_cc ?? null,
    billingAddress: address || null,
    language: billing?.default_language ?? "es",
    purchaseOrderReference: null,
    clientNote: billing?.default_note ?? null,
    internalNote: `Creado desde perfil recurrente: ${recurring.name}`,
    discountType: "none",
    discountValue: 0,
    taxRate: Number(
      recurring.default_tax_rate ?? settings?.default_tax_rate ?? 0,
    ),
    items: recurring.default_items,
  });
}
