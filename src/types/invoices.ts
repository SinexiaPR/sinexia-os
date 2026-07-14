export type InvoiceStatus =
  "draft" | "issued" | "sent" | "viewed" | "paid" | "overdue" | "cancelled";

export type InvoiceDiscountType = "none" | "fixed" | "percentage";
export type InvoiceDeliveryStatus =
  "pending" | "sent" | "failed" | "not_configured";

export type BillingSettings = {
  id: string;
  settings_key: string;
  issuer_legal_name: string | null;
  issuer_display_name: string;
  logo_storage_path: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  contact_email: string | null;
  phone: string | null;
  payment_method_label: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  routing_number: string | null;
  default_currency: string;
  default_tax_rate: number;
  default_footer: string | null;
  signature_storage_path: string | null;
  signature_text: string | null;
  email_sender_name: string | null;
  reply_to_email: string | null;
};

export type CompanyBillingProfile = {
  id: string;
  company_id: string;
  invoices_enabled: boolean;
  billing_legal_name: string | null;
  billing_contact_name: string | null;
  billing_email: string | null;
  billing_cc: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  default_payment_terms_days: number;
  default_language: "es" | "en";
  default_note: string | null;
  default_invoice_items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export type Invoice = {
  id: string;
  company_id: string;
  invoice_number: number | null;
  status: InvoiceStatus;
  invoice_date: string | null;
  due_date: string | null;
  currency: string;
  subtotal: number;
  discount_type: InvoiceDiscountType;
  discount_value: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  billing_name_snapshot: string | null;
  billing_contact_snapshot: string | null;
  billing_email_snapshot: string | null;
  billing_cc_snapshot: string | null;
  billing_address_snapshot: string | null;
  language: "es" | "en";
  purchase_order_reference: string | null;
  client_note: string | null;
  internal_note: string | null;
  pdf_storage_path: string | null;
  email_status: InvoiceDeliveryStatus | null;
  issued_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  is_legacy_import: boolean;
  legacy_client_label: string | null;
  companies?: { name: string; slug: string } | null;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  position: number;
  quantity: number;
  description: string;
  unit_price: number;
  amount: number;
};

export type InvoiceEmailDelivery = {
  id: string;
  invoice_id: string;
  recipient: string;
  cc: string | null;
  subject: string;
  message: string;
  delivery_status: InvoiceDeliveryStatus;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export type InvoiceEvent = {
  id: string;
  invoice_id: string;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type BillingCompany = {
  id: string;
  name: string;
  slug: string;
  billingProfile: CompanyBillingProfile | null;
  weeklyInvoiceTemplate: RecurringInvoiceProfile | null;
};

export type RecurringInvoiceProfile = {
  id: string;
  company_id: string;
  name: string;
  frequency: "weekly" | "biweekly" | "monthly" | "custom";
  weekday: number | null;
  next_generation_date: string | null;
  default_items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  default_terms_days: number;
  billing_email: string | null;
  default_currency: string;
  default_tax_rate: number;
  effective_date: string;
  template_key: string | null;
  enabled: boolean;
  companies?: { name: string } | null;
};
