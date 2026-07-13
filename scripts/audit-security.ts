import assert from "node:assert/strict";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey)
  throw new Error("Supabase audit environment is not configured.");
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const expected = new Map([
  ["admin@sinexia.com", { role: "admin", slug: null }],
  ["client@sibarita.com", { role: "client", slug: "sibarita" }],
  ["client@tresbe.com", { role: "client", slug: "tresbe" }],
  ["client@cut.com", { role: "client", slug: "cut" }],
  ["client@cutmeat.com", { role: "client", slug: "cut-meat-distributors" }],
  ["client@magol.com", { role: "client", slug: "magol" }],
]);

async function rows(table: string, select: string) {
  const { data, error } = await db.from(table).select(select).limit(5000);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as unknown as Array<Record<string, unknown>>;
}

async function main() {
  const { data: users, error: usersError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;
  const profiles = await rows(
    "profiles",
    "id,email,role,company_id,companies(slug)",
  );
  for (const [email, expectation] of expected) {
    assert.equal(
      users.users.filter((user) => user.email === email).length,
      1,
      `${email} auth user`,
    );
    const matches = profiles.filter((profile) => profile.email === email);
    assert.equal(matches.length, 1, `${email} profile`);
    assert.equal(matches[0].role, expectation.role, `${email} role`);
    const company = matches[0].companies as { slug?: string } | null;
    assert.equal(company?.slug ?? null, expectation.slug, `${email} company`);
  }
  for (const profile of profiles) {
    assert.ok(
      profile.role === "admin" || profile.role === "client",
      "valid role",
    );
    if (profile.role === "client")
      assert.ok(
        profile.company_id,
        "client company required for provisioned accounts",
      );
    if (profile.role === "admin")
      assert.equal(profile.company_id, null, "admin has no tenant company");
  }

  const [
    documents,
    reports,
    processing,
    documentProfiles,
    chunks,
    notifications,
    reportViews,
    documentViews,
    notificationReads,
    payrollEmployees,
    payrolls,
    payrollEntries,
    conversations,
    messages,
    companies,
  ] = await Promise.all([
    rows("documents", "id,company_id,uploaded_by"),
    rows("reports", "id,company_id"),
    rows("document_processing", "id,company_id,report_id,document_id"),
    rows(
      "document_profiles",
      "id,company_id,document_processing_id,report_id,document_id",
    ),
    rows("document_chunks", "id,company_id,document_processing_id"),
    rows(
      "notifications",
      "id,audience,company_id,report_id,document_id,target_user_id",
    ),
    rows("report_views", "user_id,report_id"),
    rows("document_views", "user_id,document_id"),
    rows("notification_reads", "user_id,notification_id"),
    rows("payroll_employees", "id,company_id,normalized_name"),
    rows("weekly_payrolls", "id,company_id"),
    rows("weekly_payroll_entries", "payroll_id,employee_id"),
    rows("sinexia_conversations", "id,company_id,user_id"),
    rows("sinexia_messages", "id,company_id,conversation_id"),
    rows("companies", "id,slug"),
  ]);
  const byId = (list: Array<Record<string, unknown>>) =>
    new Map(list.map((row) => [row.id, row]));
  const profileById = byId(profiles);
  const docById = byId(documents);
  const reportById = byId(reports);
  const processingById = byId(processing);
  const notificationById = byId(notifications);
  const payrollById = byId(payrolls);
  const employeeById = byId(payrollEmployees);
  const conversationById = byId(conversations);
  for (const doc of documents) {
    const uploader = profileById.get(doc.uploaded_by);
    assert.ok(uploader);
    if (uploader?.role === "client")
      assert.equal(
        doc.company_id,
        uploader.company_id,
        "document uploader company",
      );
  }
  for (const item of processing) {
    const source = item.report_id
      ? reportById.get(item.report_id)
      : docById.get(item.document_id);
    assert.equal(
      item.company_id,
      source?.company_id,
      "processing source company",
    );
  }
  for (const item of documentProfiles) {
    const parent = processingById.get(item.document_processing_id);
    assert.equal(
      item.company_id,
      parent?.company_id,
      "profile processing company",
    );
    assert.equal(item.report_id, parent?.report_id, "profile report");
    assert.equal(item.document_id, parent?.document_id, "profile document");
  }
  for (const item of chunks)
    assert.equal(
      item.company_id,
      processingById.get(item.document_processing_id)?.company_id,
      "chunk processing company",
    );
  for (const item of reportViews) {
    const user = profileById.get(item.user_id);
    const report = reportById.get(item.report_id);
    if (user?.role === "client")
      assert.equal(user.company_id, report?.company_id, "report view tenant");
  }
  for (const item of documentViews) {
    const user = profileById.get(item.user_id);
    const doc = docById.get(item.document_id);
    if (user?.role === "client")
      assert.equal(user.company_id, doc?.company_id, "document view tenant");
  }
  for (const item of notificationReads) {
    const user = profileById.get(item.user_id);
    const notification = notificationById.get(item.notification_id);
    if (user?.role === "client")
      assert.equal(
        user.company_id,
        notification?.company_id,
        "notification read tenant",
      );
  }
  for (const item of notifications) {
    if (item.report_id)
      assert.equal(
        item.company_id,
        reportById.get(item.report_id)?.company_id,
        "notification report company",
      );
    if (item.document_id)
      assert.equal(
        item.company_id,
        docById.get(item.document_id)?.company_id,
        "notification document company",
      );
  }
  const sibaritaId = companies.find(
    (company) => company.slug === "sibarita",
  )?.id;
  assert.ok(sibaritaId);
  for (const employee of payrollEmployees)
    assert.equal(employee.company_id, sibaritaId, "payroll employee tenant");
  for (const payroll of payrolls)
    assert.equal(payroll.company_id, sibaritaId, "weekly payroll tenant");
  for (const entry of payrollEntries)
    assert.equal(
      payrollById.get(entry.payroll_id)?.company_id,
      employeeById.get(entry.employee_id)?.company_id,
      "payroll entry tenant",
    );
  for (const message of messages)
    assert.equal(
      message.company_id,
      conversationById.get(message.conversation_id)?.company_id,
      "SinexIA message tenant",
    );

  const duplicateEmployees = new Set<string>();
  const employeeKeys = new Set<string>();
  for (const employee of payrollEmployees) {
    const key = `${employee.company_id}:${employee.normalized_name}`;
    if (employeeKeys.has(key)) duplicateEmployees.add(key);
    employeeKeys.add(key);
  }
  assert.equal(duplicateEmployees.size, 0, "no duplicate payroll employees");

  console.log(
    JSON.stringify(
      {
        accountsVerified: expected.size,
        profilesVerified: profiles.length,
        integrity: {
          documents: documents.length,
          reports: reports.length,
          processing: processing.length,
          profiles: documentProfiles.length,
          chunks: chunks.length,
          notifications: notifications.length,
          reportViews: reportViews.length,
          documentViews: documentViews.length,
          notificationReads: notificationReads.length,
          payrollEmployees: payrollEmployees.length,
          payrolls: payrolls.length,
          conversations: conversations.length,
          messages: messages.length,
        },
        result: "passed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Security audit failed.",
  );
  process.exitCode = 1;
});
