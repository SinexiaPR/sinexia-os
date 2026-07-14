import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20250713084000_tresbe_payroll_revision_workflow.sql",
  ),
  "utf8",
);
const actions = readFileSync(
  join(root, "src/actions/tresbe-payroll.ts"),
  "utf8",
);
const workspace = readFileSync(
  join(root, "src/components/tresbe-payroll/admin-workspace.tsx"),
  "utf8",
);

assert.match(migration, /reset_tresbe_payroll_draft/);
assert.match(migration, /reopen_tresbe_payroll/);
assert.match(
  migration,
  /Only payrolls that have not been sent can be restarted/,
);
assert.match(migration, /Only sent Tresbe payrolls can be reopened/);
assert.match(migration, /app\.tresbe_payroll_revision_id/);
assert.match(migration, /'draft_reset'/);
assert.match(migration, /'payroll_reopened'/);
assert.match(migration, /tresbe_payroll_revision_snapshots/);
assert.match(migration, /payroll_snapshot JSONB NOT NULL/);
assert.match(migration, /entries_snapshot JSONB NOT NULL/);
assert.match(migration, /jsonb_agg\(to_jsonb\(entry\)/);
assert.match(
  migration,
  /v_payroll\.status NOT IN \('sent', 'viewed', 'corrected'\)/,
);
assert.match(migration, /DELETE FROM public\.tresbe_payroll_entries/);
assert.match(migration, /employee\.is_active/);
assert.doesNotMatch(
  migration,
  /DELETE FROM public\.tresbe_payrolls/,
  "payroll history must not be hard deleted",
);
assert.match(migration, /normalized_name = 'carlos ramos'/);
assert.match(migration, /regular_hourly_rate = 17\.50/);
assert.doesNotMatch(
  migration,
  /INSERT INTO public\.tresbe_employees/,
  "Carlos Ramos must not be created without a confirmed area",
);

assert.match(actions, /supabase\.rpc\("reset_tresbe_payroll_draft"/);
assert.match(actions, /supabase\.rpc\("reopen_tresbe_payroll"/);
assert.match(workspace, /Descartar y empezar de nuevo/);
assert.match(workspace, /Reabrir para corregir/);
assert.match(workspace, /Rehacer nómina/);

console.log("TRESBE payroll restart and reopen workflow: PASS");
