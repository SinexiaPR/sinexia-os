# Changelog

All notable versions of Sinexia OS. Versions follow the internal roadmap numbering (v0.x).

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
