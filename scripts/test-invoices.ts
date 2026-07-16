import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PDFDocument } from "pdf-lib";

import { calculateInvoiceTotals } from "../src/lib/invoices/calculations";
import { buildInvoicePdf } from "../src/lib/invoices/pdf";
import type {
  BillingSettings,
  Invoice,
  InvoiceItem,
} from "../src/types/invoices";

const zeroTax = calculateInvoiceTotals({
  items: [
    { quantity: 2, unitPrice: 125.5 },
    { quantity: 1.5, unitPrice: 100 },
  ],
  discountType: "none",
  discountValue: 0,
  taxRate: 0,
});
assert.equal(zeroTax.subtotal, 401);
assert.equal(zeroTax.taxAmount, 0);
assert.equal(zeroTax.total, 401);

const taxed = calculateInvoiceTotals({
  items: [{ quantity: 3, unitPrice: 100 }],
  discountType: "percentage",
  discountValue: 10,
  taxRate: 11.5,
});
assert.equal(taxed.subtotal, 300);
assert.equal(taxed.discountAmount, 30);
assert.equal(taxed.taxableSubtotal, 270);
assert.equal(taxed.taxAmount, 31.05);
assert.equal(taxed.total, 301.05);

const invoice: Invoice = {
  id: "invoice-test",
  company_id: "company-test",
  invoice_number: 216,
  status: "issued",
  invoice_date: "2026-07-14",
  due_date: "2026-07-14",
  currency: "USD",
  subtotal: 300,
  discount_type: "percentage",
  discount_value: 10,
  discount_amount: 30,
  tax_rate: 11.5,
  tax_amount: 31.05,
  total: 301.05,
  billing_name_snapshot: "Empresas Magol",
  billing_contact_snapshot: "Administración",
  billing_email_snapshot: "billing@example.com",
  billing_cc_snapshot: null,
  billing_address_snapshot: "San Juan, Puerto Rico",
  language: "es",
  purchase_order_reference: "PO-TEST",
  client_note: "Gracias por su confianza.",
  internal_note: null,
  pdf_storage_path: null,
  email_status: null,
  issued_at: "2026-07-14T12:00:00Z",
  sent_at: null,
  viewed_at: null,
  paid_at: null,
  payment_reference: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: "2026-07-14T11:00:00Z",
  is_legacy_import: false,
  legacy_client_label: null,
};
const items: InvoiceItem[] = [
  {
    id: "item-1",
    invoice_id: invoice.id,
    position: 0,
    quantity: 3,
    description: "Paquete de servicios administrativos",
    unit_price: 100,
    amount: 300,
  },
];
const settings: BillingSettings = {
  id: "settings-test",
  settings_key: "sinexia",
  issuer_legal_name: "Sinexia LLC",
  issuer_display_name: "Sinexia",
  logo_storage_path: null,
  address_line_1: "San Juan",
  address_line_2: null,
  city: "San Juan",
  region: "PR",
  postal_code: "00901",
  contact_email: "info@example.com",
  phone: null,
  payment_method_label: "Transferencia",
  bank_account_name: "Sinexia",
  bank_account_number: "****1234",
  routing_number: "****5678",
  default_currency: "USD",
  default_tax_rate: 0,
  default_footer: "Gracias por su confianza.",
  signature_storage_path: null,
  signature_text: "Sinexia",
  email_sender_name: "Sinexia Facturación",
  reply_to_email: "info@example.com",
};

async function main() {
  const logoBytes = new Uint8Array(
    readFileSync(join(process.cwd(), "public/sinexia-invoice-logo.png")),
  );
  const pdfBytes = await buildInvoicePdf({
    invoice,
    items,
    settings,
    logoBytes,
  });
  assert.ok(pdfBytes.length > 1_000);
  const parsedPdf = await PDFDocument.load(pdfBytes);
  assert.equal(
    parsedPdf.getPageCount(),
    1,
    "a normal invoice must fit one page",
  );
  assert.equal(parsedPdf.getTitle(), "Factura 216");
  if (process.env.INVOICE_PDF_OUTPUT) {
    mkdirSync(join(process.cwd(), "tmp/pdfs"), { recursive: true });
    writeFileSync(process.env.INVOICE_PDF_OUTPUT, pdfBytes);
  }

  const root = process.cwd();
  const migration = readFileSync(
    join(root, "supabase/migrations/20250714020000_admin_invoicing.sql"),
    "utf8",
  );
  const permissionMigration = readFileSync(
    join(
      root,
      "supabase/migrations/20250714100000_invoice_permissions_weekly_defaults.sql",
    ),
    "utf8",
  );
  const sameDayMigration = readFileSync(
    join(
      root,
      "supabase/migrations/20260714120000_invoice_same_day_due_dates.sql",
    ),
    "utf8",
  );
  const draftDeleteMigration = readFileSync(
    join(
      root,
      "supabase/migrations/20260714121000_invoice_draft_delete_trigger_fix.sql",
    ),
    "utf8",
  );
  const cancelledDeleteMigration = readFileSync(
    join(
      root,
      "supabase/migrations/20260714122000_delete_cancelled_invoices.sql",
    ),
    "utf8",
  );
  assert.match(migration, /last_issued_number INTEGER/);
  assert.match(migration, /VALUES \('sinexia_global_invoice', 215\)/);
  assert.match(migration, /last_issued_number = last_issued_number \+ 1/);
  assert.match(migration, /RETURNING last_issued_number INTO assigned_number/);
  assert.match(
    migration,
    /SELECT \* INTO invoice_row FROM public\.invoices WHERE id = p_invoice_id FOR UPDATE/,
  );
  assert.doesNotMatch(migration, /MAX\s*\(\s*invoice_number\s*\)\s*\+/i);
  assert.match(migration, /invoice_number INTEGER UNIQUE/);
  assert.match(migration, /Issued invoice financial content is immutable/);
  assert.match(migration, /Issued invoices cannot be deleted/);
  assert.match(migration, /Only a non-legacy draft can be issued/);
  assert.match(migration, /\(212, 'tresbe', 'Tresbe'\)/);
  assert.match(migration, /\(215, 'cut', 'Cut Butcher Shop'\)/);
  assert.match(migration, /Clients read own published invoices/);
  assert.match(migration, /company_id = public\.current_company_id\(\)/);
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS public\.invoice_admin_details/,
  );
  assert.match(migration, /Admins manage invoice private details/);
  const invoiceTable = migration.slice(
    migration.indexOf("CREATE TABLE IF NOT EXISTS public.invoices"),
    migration.indexOf("CREATE TABLE IF NOT EXISTS public.invoice_items"),
  );
  assert.doesNotMatch(invoiceTable, /internal_note/);
  assert.match(migration, /INSERT INTO storage\.buckets\(id, name, public\)/);
  assert.match(migration, /VALUES \('invoices', 'invoices', false\)/);
  assert.doesNotMatch(
    migration,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  assert.match(
    sameDayMigration,
    /UPDATE public\.invoices[\s\S]+WHERE status = 'draft'/,
  );
  assert.doesNotMatch(
    sameDayMigration,
    /WHERE status (?:<>|!=) 'draft'/,
    "same-day migration must not rewrite issued invoice history",
  );
  assert.match(sameDayMigration, /NEW\.due_date := NEW\.invoice_date/);
  assert.match(
    sameDayMigration,
    /ALTER COLUMN default_payment_terms_days SET DEFAULT 0/,
  );
  assert.match(
    draftDeleteMigration,
    /TG_OP = 'DELETE'[\s\S]+NOT EXISTS[\s\S]+FROM public\.invoices/,
  );
  assert.match(
    draftDeleteMigration,
    /PERFORM public\.recalculate_invoice_totals\(target_invoice_id\)/,
  );
  assert.match(
    draftDeleteMigration,
    /REVOKE ALL ON FUNCTION public\.recalculate_invoice_after_item_change\(\)/,
  );
  assert.match(
    cancelledDeleteMigration,
    /OLD\.status NOT IN \('draft', 'cancelled'\)/,
  );
  assert.match(
    cancelledDeleteMigration,
    /target_invoice\.status NOT IN \('draft', 'cancelled'\)/,
  );
  assert.match(cancelledDeleteMigration, /SECURITY DEFINER/);
  assert.match(cancelledDeleteMigration, /SET search_path = public, pg_temp/);
  assert.match(
    cancelledDeleteMigration,
    /DELETE FROM public\.invoice_email_deliveries/,
  );
  assert.match(
    cancelledDeleteMigration,
    /GRANT EXECUTE ON FUNCTION public\.delete_admin_invoice\(UUID\)[\s\S]+TO authenticated/,
  );
  assert.doesNotMatch(cancelledDeleteMigration, /GRANT EXECUTE[\s\S]+TO anon/);

  assert.match(
    permissionMigration,
    /CREATE OR REPLACE FUNCTION public\.recalculate_invoice_totals\(value UUID\)/,
  );
  assert.match(permissionMigration, /SECURITY DEFINER/);
  assert.match(permissionMigration, /SET search_path = public, pg_temp/);
  assert.match(
    permissionMigration,
    /auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\)/,
  );
  assert.match(
    permissionMigration,
    /REVOKE ALL ON FUNCTION public\.recalculate_invoice_totals\(UUID\)[\s\S]+FROM PUBLIC, anon/,
  );
  assert.match(
    permissionMigration,
    /GRANT EXECUTE ON FUNCTION public\.recalculate_invoice_totals\(UUID\)[\s\S]+TO authenticated/,
  );
  assert.doesNotMatch(
    permissionMigration,
    /GRANT EXECUTE[\s\S]+TO anon/,
    "anon must not execute invoice management functions",
  );
  assert.match(
    permissionMigration,
    /sum\(round\(item\.quantity \* item\.unit_price, 2\)\)/,
  );
  assert.match(permissionMigration, /taxable_subtotal/);
  assert.match(permissionMigration, /NOTIFY pgrst, 'reload schema'/);
  assert.match(permissionMigration, /'weekly-tresbe'[\s\S]+250\.00/);
  assert.match(permissionMigration, /'weekly-sibarita'[\s\S]+250\.00/);
  assert.match(
    permissionMigration,
    /'weekly-cut-meat-distributors'[\s\S]+180\.00/,
  );
  assert.match(permissionMigration, /'weekly-cut-butcher-shop'[\s\S]+320\.00/);
  assert.match(permissionMigration, /'weekly-magol'[\s\S]+130\.00/);
  assert.match(permissionMigration, /frequency = 'weekly'/);
  assert.match(permissionMigration, /ON CONFLICT \(company_id, template_key\)/);
  assert.match(permissionMigration, /invoice_template_match_reviews/);
  assert.doesNotMatch(
    permissionMigration,
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    "company UUIDs must not be hardcoded",
  );
  assert.doesNotMatch(
    permissionMigration,
    /UPDATE public\.invoices[\s\S]+status = 'issued'/,
    "template migration must not modify issued invoices",
  );

  const invoiceActions = readFileSync(
    join(root, "src/actions/invoices.ts"),
    "utf8",
  );
  assert.match(invoiceActions, /await requireAdmin\(\)/);
  assert.match(
    invoiceActions,
    /No se pudieron calcular los totales de la factura/,
  );
  assert.match(invoiceActions, /postgres_error_code/);
  assert.match(invoiceActions, /authenticated_user_id/);
  assert.doesNotMatch(invoiceActions, /service.role|SERVICE_ROLE/);
  const invoiceService = readFileSync(
    join(root, "src/services/invoices.ts"),
    "utf8",
  );
  const invoiceEditor = readFileSync(
    join(root, "src/components/invoices/invoice-editor.tsx"),
    "utf8",
  );
  assert.match(invoiceService, /weeklyInvoiceTemplate/);
  assert.match(invoiceService, /\.eq\("frequency", "weekly"\)/);
  assert.match(invoiceService, /\.eq\("enabled", true\)/);
  assert.match(invoiceEditor, /existingItems\.length/);
  assert.match(invoiceEditor, /initialTemplate\?\.default_items/);
  assert.match(invoiceEditor, /template\?\.default_tax_rate/);
  assert.match(invoiceEditor, /dueDate: invoiceDate/);
  assert.match(invoiceEditor, /aria-readonly="true"/);
  assert.match(invoiceActions, /"delete_admin_invoice"/);
  assert.match(invoiceActions, /sinexia-invoice-logo\.png/);

  for (const route of [
    "src/app/(dashboard)/dashboard/admin/invoices/page.tsx",
    "src/app/(dashboard)/dashboard/admin/invoices/new/page.tsx",
    "src/app/(dashboard)/dashboard/admin/settings/billing/page.tsx",
  ])
    assert.match(readFileSync(join(root, route), "utf8"), /requireAdmin\(\)/);
  assert.match(
    readFileSync(
      join(root, "src/app/(dashboard)/dashboard/invoices/page.tsx"),
      "utf8",
    ),
    /requireClient\(\)/,
  );
  assert.match(
    readFileSync(
      join(root, "src/app/api/invoices/[invoiceId]/download/route.ts"),
      "utf8",
    ),
    /profile\.company_id !== invoice\.company_id/,
  );

  console.log(
    "Invoice calculations, PDF, sequence and authorization guards: PASS",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
