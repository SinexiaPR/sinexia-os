# Security and End-to-End QA Audit

Audit date: 2026-07-12 / 2026-07-13 (America/Argentina/Cordoba)

## Executive result

The six requested Auth users and profiles exist and have the intended roles and company assignments. A service-role read-only integrity audit found no existing cross-company inconsistencies across documents, reports, processing, profiles, chunks, notifications, viewed/read state, payroll, or SinexIA conversations/messages.

Five authorization/integrity gaps were identified and fixed in the pending idempotent migration `20250713030000_security_tenant_hardening.sql`. Production is not yet hardened until that migration is reviewed and applied.

## Findings

| Severity | Finding                                                                                                                                                           | Resolution                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Critical | A self-update RLS policy allowed clients to attempt changes to `profiles.role` and `profiles.company_id`.                                                         | Added immutable authorization-field trigger, narrowed self-update policy, and explicit admin update policy.       |
| Critical | `handle_new_user()` trusted `raw_user_meta_data.role/company_id`, permitting unsafe public provisioning.                                                          | Public users now receive an unassigned client profile; assignment is service/admin-only.                          |
| High     | `report_views`, `document_views`, and `notification_reads` checked the user ID but did not consistently validate access to the referenced entity.                 | Added security-definer ownership helpers and entity-aware SELECT/INSERT/UPDATE policies.                          |
| High     | Company IDs in processing, profiles, chunks, notifications, SinexIA messages, and payroll entries were duplicated without database-level relationship validation. | Added idempotent validation triggers and preflight checks that abort on existing mismatches.                      |
| Medium   | User seed tooling relied on unsafe signup metadata and logged a default password.                                                                                 | Requires `SEED_USER_PASSWORD`, provisions profiles explicitly through service role, and no longer logs passwords. |
| Low      | Report actions and form components emitted unnecessary return-state/raw error logs.                                                                               | Removed return-state logs and reduced server error logging to sanitized message/code/context.                     |

## Production data audit

- Auth accounts verified: 6/6
- Profiles verified: 6/6
- Admin profile: admin role, no company
- Client profiles: client role, exactly one expected company
- Documents checked: 6
- Reports checked: 2
- Processing rows checked: 4
- Structured profiles checked: 3
- Document chunks checked: 0 (valid empty state)
- Notifications checked: 24
- Report views checked: 2
- Document views checked: 8
- Notification reads checked: 20
- Payroll employees checked: 18, no normalized duplicates
- Weekly payrolls checked: 1
- SinexIA conversations/messages checked: 44/88
- Existing integrity mismatches: 0

## Route protection

- Admin calendar and company workspace routes call `requireAdmin()` in server components.
- Payroll resolves Sibarita on the server; client company ID must match the authenticated profile.
- SinexIA ignores URL company input and derives tenant context from the authenticated profile.
- Admin/client inbox and report surfaces branch by the server profile role.
- Middleware refreshes sessions and protected dashboard pages use no-store behavior.

## Automated validation

- `npm run audit:security`: passed against production (read-only)
- `npm run test:security`: passed
- `npm run test:calendar`: passed
- `npm run test:company-workspace`: passed
- `npm run test:sibarita-payroll`: passed
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build`: passed
- `npx supabase db push --dry-run`: only the hardening migration is pending

`supabase/tests/security_tenant_isolation.sql` provides transactional negative RLS checks after migration application.

## Manual QA status

Interactive login flows were not marked as passed because account passwords were not provided. No passwords were reset and no temporary Auth users were created.

| User     | Account/profile | Integrity/isolation audit       | Interactive E2E     |
| -------- | --------------- | ------------------------------- | ------------------- |
| Admin    | Passed          | Passed                          | Pending credentials |
| Sibarita | Passed          | Passed; payroll tenant verified | Pending credentials |
| Tresbe   | Passed          | Passed                          | Pending credentials |
| Cut      | Passed          | Passed                          | Pending credentials |
| Cut Meat | Passed          | Passed                          | Pending credentials |
| Magol    | Passed          | Passed                          | Pending credentials |

## Known functionality gaps not changed

- Payroll currently has submission and approval, but no dedicated “request correction” event, admin notification on submission, or printable summary. These are product features, not safe security-only changes.
- Daily calendar due notifications require the previously documented Supabase Cron schedule.
- Upload QA for image-only PDF, Word, XLS, CSV, and image fixtures requires authenticated browser sessions and representative files; it was not simulated with production data.
- Full SinexIA question/answer QA was not executed to avoid unplanned OpenAI usage. Existing deterministic payroll/AR tests remain passing.

## Required deployment sequence

1. Review and apply `20250713030000_security_tenant_hardening.sql`.
2. Run `supabase/tests/security_tenant_isolation.sql` against the linked project.
3. Perform the interactive user matrix with supplied credentials.
4. Merge only after those checks pass; do not deploy the application before the database migration.
