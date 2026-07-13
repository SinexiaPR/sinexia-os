import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20250713060000_payroll_reopen_audit.sql"),
  "utf8",
);
const action = readFileSync(resolve("src/actions/payroll.ts"), "utf8");
const workspace = readFileSync(
  resolve("src/components/payroll/payroll-workspace.tsx"),
  "utf8",
);

assert.match(
  migration,
  /CREATE TABLE IF NOT EXISTS public\.payroll_reopen_events/,
);
assert.match(migration, /previous_status IN \('submitted', 'approved'\)/);
assert.match(migration, /reason TEXT NOT NULL CHECK/);
assert.match(migration, /v_actor IS NULL OR NOT public\.is_admin\(\)/);
assert.match(migration, /FOR UPDATE/);
assert.match(migration, /SET status = 'draft'/);
assert.match(migration, /submitted_at = NULL/);
assert.match(migration, /approved_at = NULL/);
assert.match(migration, /app\.payroll_reopen_payroll_id/);
assert.match(migration, /REVOKE ALL ON FUNCTION.*FROM PUBLIC/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION.*\n  TO authenticated/);
assert.match(action, /profile\.role !== "admin"/);
assert.match(action, /supabase\.rpc\("reopen_weekly_payroll"/);
assert.match(workspace, /isAdmin && selected\.status !== "draft"/);
assert.match(workspace, /minLength=\{10\}/);
assert.match(workspace, /maxLength=\{500\}/);

console.log("Payroll reopen authorization and audit tests passed.");
