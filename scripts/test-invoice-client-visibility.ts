import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const migration = read(
  "supabase/migrations/20260714160000_invoice_client_visibility_notifications.sql",
);
const adminCompanyPage = read(
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/invoices/page.tsx",
);
const companyDashboard = read(
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/page.tsx",
);
const clientPage = read("src/app/(dashboard)/dashboard/invoices/page.tsx");
const workspaceService = read("src/services/company-workspace.ts");
const invoiceService = read("src/services/invoices.ts");
const tracker = read("src/components/invoices/invoice-view-tracker.tsx");
const authorization = read("supabase/tests/invoice_authorization.sql");

assert.match(migration, /OLD\.status = 'draft' AND NEW\.status = 'issued'/);
assert.match(migration, /profile\.company_id = NEW\.company_id/);
assert.match(migration, /profile\.role = 'client'/);
assert.match(
  migration,
  /'invoice-issued:' \|\| NEW\.id::TEXT \|\| ':' \|\| profile\.id::TEXT/,
);
assert.match(migration, /target_user_id/);
assert.match(migration, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
assert.match(migration, /notification\.invoice_id = p_invoice_id/);
assert.match(migration, /notification\.kind = 'invoice_issued'/);
assert.match(migration, /notification\.target_user_id = auth\.uid\(\)/);
assert.match(
  migration,
  /invoice notification target does not match company client/,
);
assert.match(migration, /SET viewed_at = COALESCE\(viewed_at, now\(\)\)/);

const markViewedFunction = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.mark_invoice_viewed"),
  migration.indexOf("REVOKE ALL ON FUNCTION public.mark_invoice_viewed"),
);
assert.doesNotMatch(markViewedFunction, /SET status = 'viewed'/);
assert.match(migration, /targeted\.target_user_id = old_read\.user_id/);
assert.match(migration, /NOT invoice\.is_legacy_import/);
assert.doesNotMatch(
  migration,
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
);

assert.match(adminCompanyPage, /requireAdmin\(\)/);
assert.match(adminCompanyPage, /getInvoices\(companyId\)/);
assert.match(adminCompanyPage, /No hay facturas generadas para esta empresa\./);
assert.match(adminCompanyPage, /invoice\.viewed_at/);
assert.match(adminCompanyPage, /Descargar PDF/);
assert.match(companyDashboard, /summary\.invoice\.unpaidCount/);
assert.match(companyDashboard, /Ver facturas/);
assert.match(workspaceService, /\.eq\("company_id", companyId\)/);

assert.match(clientPage, /requireClient\(\)/);
assert.match(clientPage, /getInvoices\(profile\.company_id\)/);
assert.match(clientPage, /const selectedId = invoiceId;/);
assert.match(clientPage, /No tienes facturas disponibles\./);
assert.match(clientPage, /Ver factura/);
assert.doesNotMatch(clientPage, /internal_note/);
assert.match(invoiceService, /shouldShowCompanyInvoices/);
assert.match(invoiceService, /"issued",\s*"sent",\s*"viewed"/);
assert.match(tracker, /router\.refresh\(\)/);
assert.match(tracker, /trackedInvoice\.current === invoiceId/);

assert.match(authorization, /client read another company invoice/);
assert.match(authorization, /mark another company invoice viewed/);
assert.match(authorization, /read another user''s invoice notification/);
assert.match(authorization, /mark another user''s invoice notification read/);
assert.match(authorization, /admin cannot read invoices/);

console.log("Invoice client visibility, notifications and tenant guards: PASS");
