import { createClient } from "@/lib/supabase/server";
import type {
  BillingCompany,
  BillingSettings,
  CompanyBillingProfile,
  Invoice,
  InvoiceEmailDelivery,
  InvoiceEvent,
  InvoiceItem,
  RecurringInvoiceProfile,
} from "@/types/invoices";

export async function getBillingSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_settings")
    .select("*")
    .eq("settings_key", "sinexia")
    .maybeSingle();
  if (error) throw error;
  return data as BillingSettings | null;
}

export async function getRecurringInvoiceProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_invoice_profiles")
    .select("*,companies(name)")
    .order("next_generation_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as RecurringInvoiceProfile[];
}

export async function getBillingCompanies(): Promise<BillingCompany[]> {
  const supabase = await createClient();
  const [{ data: companies, error }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase.from("companies").select("id,name,slug").order("name"),
      supabase.from("company_billing_profiles").select("*"),
    ]);
  if (error) throw error;
  if (profileError) throw profileError;
  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.company_id, profile]),
  );
  return (companies ?? []).map((company) => ({
    ...company,
    billingProfile:
      (profileMap.get(company.id) as CompanyBillingProfile) ?? null,
  }));
}

export async function isCompanyInvoicingEnabled(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_billing_profiles")
    .select("invoices_enabled")
    .eq("company_id", companyId)
    .maybeSingle();
  return data?.invoices_enabled === true;
}

export async function getInvoices(companyId?: string | null) {
  const supabase = await createClient();
  await supabase.rpc("refresh_invoice_overdue_statuses");
  let query = supabase
    .from("invoices")
    .select("*,companies(name,slug)")
    .order("invoice_number", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export async function getInvoice(invoiceId: string) {
  const supabase = await createClient();
  const [
    invoiceResult,
    itemsResult,
    deliveriesResult,
    eventsResult,
    adminDetailsResult,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("*,companies(name,slug)")
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position"),
    supabase
      .from("invoice_email_deliveries")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_events")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_admin_details")
      .select("internal_note")
      .eq("invoice_id", invoiceId)
      .maybeSingle(),
  ]);
  if (invoiceResult.error) throw invoiceResult.error;
  if (itemsResult.error) throw itemsResult.error;
  return {
    invoice: invoiceResult.data
      ? ({
          ...invoiceResult.data,
          internal_note: adminDetailsResult.data?.internal_note ?? null,
        } as Invoice)
      : null,
    items: (itemsResult.data ?? []) as InvoiceItem[],
    deliveries: (deliveriesResult.data ?? []) as InvoiceEmailDelivery[],
    events: (eventsResult.data ?? []) as InvoiceEvent[],
  };
}
