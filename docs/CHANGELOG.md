# Changelog

All notable versions of Sinexia OS. Versions follow the internal roadmap numbering (v0.x).

---

## Unreleased

### Added

- Informes diarios (Cut Meat Distributors / Wagyu Food Service LLC): admin-only module replacing the manual daily Google Sheet — Reconciliation Report, bank export, Consolidated, Aging Vendors and Aging Customers PDFs, with versioned private storage and an audit log (see `docs/DAILY_REPORTS_CUTMEAT.md`)
- Recurrentes e Historial diario (Cut Meat Distributors): monthly recurring-payments tracker with weekly totals and a read-only daily reconciliation backfill, admin read/write and the company's client read-only (see `docs/CUTMEAT_RECURRENTES.md`)
- Paquete para el dueño (Cut Meat Distributors): merges the 5 daily report PDFs into one package with a highlighted cover, plus a shareable cover PNG; versioned private storage, admin generates/regenerates/marks sent, the company's client reads and downloads only (see `docs/CUTMEAT_PACKAGE.md`)
- Informes diarios data contract (Cut Meat Distributors): PDF upload removed from the 3 input tabs (manual entry only; extractors kept but deprecated), every externally-loaded day stays in draft with its origin tracked (`source`/`loaded_by`/`loaded_at`), a DB-level trigger blocks writes to closed days, per-invoice aging detail reproduces the original grouped PDF format, and a read-only `cutmeat_daily_controls` SQL function recomputes the day's 4 reconciliation checks (see `docs/CUTMEAT_DAILY_DATA_CONTRACT.md`)

### Fixed

- Informes diarios (Cut Meat Distributors): Balance GABRIEL now carries forward the prior closed day's Balance after Weekly Payments instead of subtracting a variance from today's own balance; the 7/14/21-day Financial Report labels now land on the Saturday of the report's week (+2/+9/+16 days) instead of a fixed offset from the report date; the current week's income projection is a flat configurable weekly amount instead of a per-day sum; Variación Diaria is now free-form concept+amount lines instead of an auto-derived comparison; and the module now reads its recurring payments from `cutmeat_recurrentes` (the same source as the Recurrentes screen) instead of a separate, now-deprecated table

---

## v0.5 — Notifications & Portal UX ✅

**Status:** Implemented (current release)

### Added

- In-app notification system (`notifications`, `notification_reads`)
- Notification bell with unread badge (client and admin)
- Mark one / mark all notifications as read
- Report view tracking (`report_views`) and "Nuevo" badge
- Reports navigation unread count
- Recent activity on executive dashboard (live Supabase data)
- Shared logout via Server Action with SSR cookie clearing
- Spanish relative date formatting for activity and notifications
- DB triggers for notification events (reports, documents, processing)

### Fixed

- Client portal infinite render loop in unread reports hook
- Logout regression (form-based server action sign-out)

---

## v0.4 — Executive Dashboard ✅

**Status:** Implemented

### Added

- Client executive dashboard replacing basic landing view
- Metrics: published reports, pending documents, analyzed documents
- Last report and last update summary cards
- Quick actions (upload, reports, SinexIA, WhatsApp contact)
- Recent activity feed (reports, documents, SinexIA completions)
- Client-specific dashboard layout and Spanish copy

---

## v0.3 — Document Intelligence ✅

**Status:** Implemented

### Added

- SinexIA document processing pipeline
- PDF, Excel, and CSV extraction
- Document classification and type detection
- Structured profiles (`document_profiles`)
- Embeddings and vector retrieval
- SinexIA chat interface (`/dashboard/sia`)
- Query engine with intent detection
- OpenAI GPT integration with response cache
- QuickBooks Accounts Receivable specialized extractor (v1)
- Content-hash deduplication to skip unchanged files
- Admin report intelligence status display
- Report processing on publish

### Changed

- Reports support automatic SinexIA analysis on upload

---

## v0.2 — Client Portal ✅

**Status:** Implemented

### Added

- Separate admin and client workspace layouts
- Client navigation: Dashboard, Inbox, Reports, SinexIA, Profile
- Admin navigation: Dashboard, Inbox, Reports, Profile
- Document inbox with client upload and admin review
- Document status workflow (received → reviewing → processed / rejected)
- Reports module — admin publish, client view and download
- Signed URL access for private storage files
- Profile page with company information
- Mobile navigation (sheet) for both roles
- WhatsApp support button

---

## v0.1 — Infrastructure ✅

**Status:** Implemented

### Added

- Next.js 15 App Router project scaffold
- Supabase integration (Auth, PostgreSQL, Storage)
- Companies and profiles with Row Level Security
- Admin and client role model
- Middleware session management
- Private `documents` storage bucket
- Dev seed script (`npm run seed:users`)
- Initial company seed: Sibarita, Tresbe, Cut, Cut Meat Distributors, Magol
- Environment variable validation

---

## Upcoming

See [ROADMAP.md](./ROADMAP.md) for planned v0.6+ work.
