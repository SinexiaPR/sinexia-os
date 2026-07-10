# Architecture

Sinexia OS is a **Next.js full-stack application** backed by **Supabase**. Business logic lives in Server Actions and service modules; the SinexIA intelligence pipeline runs server-side with optional OpenAI augmentation.

---

## High-Level Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Next.js App │────▶│    Supabase     │
│  (Client /  │     │  Middleware  │     │  Auth · DB ·    │
│   Admin)    │◀────│  Server      │◀────│  Storage · RLS  │
└─────────────┘     │  Actions     │     └─────────────────┘
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   OpenAI     │
                    │  (optional)  │
                    └──────────────┘
```

---

## Frontend (Next.js)

| Concern | Implementation |
|---------|----------------|
| Routing | App Router — `(marketing)`, `(auth)`, `(dashboard)` route groups |
| Layouts | Separate **client** and **admin** workspace shells |
| Data fetching | Server Components + service layer (`src/services/`) |
| Mutations | Server Actions (`src/actions/`) |
| Client state | Minimal — hooks for unread badges, notification bell |
| i18n (UI) | Spanish for client-facing surfaces |

Protected routes under `/dashboard` require authentication via middleware.

---

## Supabase

### PostgreSQL

Core tables include:

- `companies`, `profiles` — multi-tenant identity
- `documents` — client uploads with status workflow
- `reports` — admin-published report metadata
- `document_processing` — SinexIA pipeline state per document/report
- `document_profiles` — structured extracted data
- `sinexia_gpt_cache` — cached GPT responses
- `notifications`, `notification_reads`, `report_views` — portal UX

### Row Level Security (RLS)

- **Clients** read/write only within their `company_id`
- **Admins** read across companies; update document status and publish reports
- **Service role** used server-side for processing pipelines and notification triggers

Company isolation is enforced at the database layer, not only in the UI.

---

## Authentication

| Component | Role |
|-----------|------|
| Supabase Auth | Email/password login |
| `profiles` table | Role (`admin` \| `client`), `company_id`, synced from auth metadata |
| Middleware | Session refresh, redirect unauthenticated users to `/login` |
| Server Actions | `signIn`, `signOut` via Supabase SSR server client |

Logout clears SSR session cookies and redirects to `/login`. Dashboard routes use `Cache-Control: no-store` to prevent back-navigation to cached authenticated pages.

---

## Storage

| Bucket | Purpose |
|--------|---------|
| `documents` | Client-uploaded files (private, signed URLs) |
| `reports` | Admin-published report files (private, signed URLs) |

Files are stored by path; access uses time-limited signed URLs generated server-side.

---

## Document Intelligence (SinexIA Pipeline)

Located in `src/lib/intelligence/`. Triggered when documents are uploaded or reports are published.

### Processing stages

1. **Ingest** — Download file from Storage
2. **Extract** — PDF, Excel, or CSV text/data extraction
3. **Classify** — Detect document type (payroll, AR aging, bank statement, etc.)
4. **Specialized extractors** — Type-specific structured parsing (e.g. QuickBooks AR)
5. **Profile store** — Persist `document_profiles` with structured JSON + summary
6. **Embeddings** (optional) — Chunk and embed for retrieval when profiles are insufficient
7. **Status update** — `document_processing.status`: `pending` → `processing` → `completed` / `failed` / `requires_ocr`

Content hashing avoids reprocessing unchanged files.

---

## Structured Profiles

Structured profiles (`document_profiles`) are the **primary knowledge source** for SinexIA:

- Document type, period, confidence score
- `structured_data` JSON (type-specific schema)
- Human-readable `summary`

The query engine reads profiles directly for deterministic answers (totals, counts, comparisons) before invoking OpenAI.

---

## OpenAI

| Use | Details |
|-----|---------|
| GPT responses | When query intent requires natural language or profiles are insufficient |
| Caching | `sinexia_gpt_cache` keyed by normalized question + context |
| Security | `OPENAI_API_KEY` is server-only; never exposed to the client |

Cost optimization: structured query engine first, GPT second, cache third.

---

## Report Processing

When an admin publishes a report:

1. File uploaded to `reports` bucket
2. Report row inserted in `reports` table
3. SinexIA pipeline runs against the report file (same intelligence path as documents)
4. DB trigger notifies client users (`Nuevo reporte publicado`)
5. Client views report; `report_views` tracks per-user read state

Report download uses a dedicated API route with signed URLs.

---

## Notifications

Event-driven notifications via PostgreSQL triggers (no application-code coupling to processing logic):

| Audience | Example events |
|----------|----------------|
| Client | Report published, document received, status changes, SinexIA completed/failed |
| Admin | Client upload, processing failed, requires OCR/review |

Notifications are stored in `notifications`; read state in `notification_reads`. RLS enforces company isolation for clients.

---

## Data Flow: Upload → SinexIA Response

```
Client uploads document
        │
        ▼
Server Action → Storage (documents bucket)
        │
        ▼
documents row INSERT (status: received)
        │
        ├──▶ Notification triggers (client + admin)
        │
        ▼
document_processing row created
        │
        ▼
Intelligence pipeline (server, service role)
  extract → classify → specialized extractor → profile
        │
        ▼
document_processing.status = completed
        │
        ├──▶ Notification (SinexIA completado)
        │
        ▼
Client opens SinexIA (/dashboard/sia)
        │
        ▼
User asks question
        │
        ▼
Query engine reads structured profiles
        │
        ├──▶ Deterministic answer (no GPT)
        │
        └──▶ OpenAI + cache (if needed)
        │
        ▼
Response returned to client UI
```

---

## Key Module Map

| Path | Responsibility |
|------|----------------|
| `src/actions/` | Auth, documents, reports, intelligence, notifications |
| `src/services/` | Supabase queries for dashboard, inbox, reports |
| `src/lib/intelligence/` | Full SinexIA pipeline |
| `src/lib/supabase/` | Browser, server, admin, middleware clients |
| `src/middleware.ts` | Auth gate, cache headers |
| `supabase/migrations/` | Schema, RLS, triggers |
