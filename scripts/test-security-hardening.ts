import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read(
  "supabase/migrations/20250713030000_security_tenant_hardening.sql",
);

for (const required of [
  "protect_profile_authorization_fields",
  "'client',NULL",
  "can_access_report",
  "can_access_document",
  "can_access_notification",
  "document_processing_company_integrity",
  "document_profiles_company_integrity",
  "document_chunks_company_integrity",
  "notifications_company_integrity",
  "sinexia_messages_company_integrity",
  "weekly_payroll_entries_company_integrity",
])
  assert.ok(migration.includes(required), required);

assert.match(migration, /report_views[\s\S]*can_access_report\(report_id\)/);
assert.match(
  migration,
  /document_views[\s\S]*can_access_document\(document_id\)/,
);
assert.match(
  migration,
  /notification_reads[\s\S]*can_access_notification\(notification_id\)/,
);
assert.doesNotMatch(migration, /raw_user_meta_data\s*->>\s*'role'/);
assert.doesNotMatch(migration, /raw_user_meta_data\s*->>\s*'company_id'/);

const adminRoutes = [
  "src/app/(dashboard)/dashboard/calendar/page.tsx",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/page.tsx",
  "src/app/(dashboard)/dashboard/admin/companies/[companyId]/[category]/page.tsx",
];
for (const route of adminRoutes)
  assert.match(read(route), /requireAdmin\(\)/, `${route} server role check`);
assert.match(
  read("src/app/(dashboard)/dashboard/payroll/page.tsx"),
  /profile\.role === "client"[\s\S]*profile\.company_id/,
);
assert.match(
  read("src/actions/payroll.ts"),
  /profile\.role !== "admin"[\s\S]*Solo un administrador puede aprobar/,
);

console.log("Security hardening and server route protection tests passed.");
