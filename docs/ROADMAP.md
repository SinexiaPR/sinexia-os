# Roadmap

Roadmap organized by version. **v0.5 is the current completed release.**

---

## v0.1 — Infrastructure ✅ Completed

**Goal:** Secure multi-tenant foundation.

- Supabase project setup (Auth, PostgreSQL, Storage)
- Companies and profiles with RLS
- Admin and client roles
- Document inbox with upload to private storage
- Middleware-protected dashboard routes
- Dev seed script for users and companies

---

## v0.2 — Client Portal ✅ Completed

**Goal:** Usable client and admin workspaces.

- Split admin vs client layouts (sidebar, header, mobile nav)
- Client inbox with upload form
- Admin inbox with cross-company document list and status updates
- Reports module — admin publish, client view/download
- Profile page and authentication flows
- WhatsApp support link

---

## v0.3 — Document Intelligence ✅ Completed

**Goal:** SinexIA reads documents and answers questions.

- Document processing pipeline (PDF, Excel, CSV)
- Document classification and type detection
- Structured profiles stored in PostgreSQL
- Embeddings and retrieval for unstructured content
- SinexIA chat panel (`/dashboard/sia`)
- Query engine with intent detection
- OpenAI integration with response caching
- QuickBooks Accounts Receivable specialized extractor (v1)
- Content-hash deduplication for processing

---

## v0.4 — Executive Dashboard ✅ Completed

**Goal:** Client-facing operational overview.

- Executive client dashboard with metrics (reports, pending docs, analyzed docs)
- Last report and last activity summary cards
- Quick actions (upload, reports, SinexIA, contact)
- Recent activity feed from live Supabase data
- Report unread badges and per-report "Nuevo" indicator

---

## v0.5 — Notifications & Portal UX ✅ Completed (Current)

**Goal:** Operational awareness and reliable session management.

- In-app notification bell (client and admin)
- DB-backed notifications with deduplication and RLS
- Report view tracking (`report_views`)
- Shared logout via Server Action (SSR cookie clearing)
- Spanish UI copy for client surfaces
- Relative date formatting for activity and notifications

---

## Future — v0.6+

### Near term

- Additional specialized extractors (payroll, AP aging, bank reconciliation)
- Client-specific extractor configuration per company
- Notification email digests (optional)
- Admin analytics dashboard

### Medium term

- Scheduled report reminders and SLA tracking
- Document versioning and audit trail
- Bulk report upload
- SinexIA proactive summaries on dashboard

### Long term

- API integrations with client accounting systems (read-only)
- Multi-language support
- Mobile-optimized PWA experience
- Client onboarding self-service flow

---

## Version Summary

| Version | Theme | Status |
|---------|-------|--------|
| v0.1 | Infrastructure | ✅ Completed |
| v0.2 | Client Portal | ✅ Completed |
| v0.3 | Document Intelligence | ✅ Completed |
| v0.4 | Executive Dashboard | ✅ Completed |
| v0.5 | Notifications & Portal UX | ✅ Completed (current) |
| v0.6+ | Extractors & integrations | 🔜 Future |
