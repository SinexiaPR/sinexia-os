# Sinexia OS — Project Documentation

Sinexia OS is the internal client and admin portal for **Sinexia**, a Puerto Rico–based administrative services firm. The platform lets client companies upload documents, receive published reports, and interact with **SinexIA** — an AI assistant built on top of structured document intelligence.

This folder contains product, architecture, deployment, and client documentation. It is intended for developers, operators, and stakeholders working on the platform.

---

## Main Features

| Area                    | Description                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Client portal**       | Dashboard, document inbox, reports, SinexIA chat, profile                                       |
| **Admin workspace**     | Cross-company inbox, report publishing, document status management                              |
| **Authentication**      | Supabase Auth with role-based access (`admin` / `client`) and company isolation                 |
| **Document inbox**      | Clients upload invoices and administrative files; admins review and update status               |
| **Reports**             | Admins publish PDF/Excel/CSV reports per company; clients view, download, and query via SinexIA |
| **SinexIA**             | Document intelligence pipeline: extraction, structured profiles, query engine, OpenAI fallback  |
| **Notifications**       | In-app notifications for document and report events (client and admin audiences)                |
| **Executive dashboard** | Client metrics, quick actions, and recent activity from live Supabase data                      |
| **Admin invoicing**     | Draft, issue, store and deliver tenant-isolated client invoices with an atomic global sequence  |

---

## Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Frontend         | Next.js 15 (App Router), React 19, TypeScript |
| Styling          | Tailwind CSS 4, Radix UI primitives           |
| Backend / DB     | Supabase (PostgreSQL, Auth, Storage, RLS)     |
| AI               | OpenAI API (server-only, optional GPT cache)  |
| Document parsing | pdf-parse, xlsx, csv-parse                    |
| Deployment       | Vercel (frontend), Supabase (backend)         |

---

## Folder Structure

```
sinexia-os/
├── docs/                    # Project documentation (this folder)
├── src/
│   ├── app/                 # Next.js routes (marketing, auth, dashboard)
│   ├── actions/             # Server Actions (auth, documents, reports, SinexIA)
│   ├── components/          # UI components (layout, dashboard, reports, assistant)
│   ├── config/              # Site, navigation, env, contact config
│   ├── hooks/               # Client hooks
│   ├── lib/                 # Auth, Supabase clients, intelligence pipeline
│   ├── services/            # Data access layer
│   └── types/               # Shared TypeScript types
├── supabase/
│   └── migrations/          # SQL migrations (schema, RLS, triggers)
├── scripts/
│   └── seed-users.ts        # Dev seed script for admin/client users
└── .env.example             # Environment variable template
```

---

## Local Development

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (local or hosted)
- OpenAI API key (for SinexIA GPT responses)

### Setup

```bash
git clone <repository-url>
cd sinexia-os
npm install
cp .env.example .env.local
# Fill in .env.local (see below)
npx supabase db push          # Apply migrations to linked project
npm run seed:users            # Optional: create dev users
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful Commands

| Command              | Purpose                     |
| -------------------- | --------------------------- |
| `npm run dev`        | Start development server    |
| `npm run build`      | Production build            |
| `npm run lint`       | ESLint                      |
| `npm run typecheck`  | TypeScript check            |
| `npm run seed:users` | Seed admin and client users |

---

## Environment Variables

Copy `.env.example` to `.env.local`. **Never commit secrets.**

| Variable                        | Scope       | Description                              |
| ------------------------------- | ----------- | ---------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | Public      | App URL (e.g. `http://localhost:3000`)   |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public      | Supabase project URL                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public      | Supabase anonymous key                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only | Service role key (processing, seeds)     |
| `OPENAI_API_KEY`                | Server only | OpenAI API key for SinexIA               |
| `NEXT_PUBLIC_SINEXIA_URL`       | Public      | Corporate website link (optional)        |
| `SEED_USER_PASSWORD`            | Script only | Password for seeded dev users (optional) |

Server-only variables must never use the `NEXT_PUBLIC_` prefix.

---

## Deployment Overview

Sinexia OS deploys as a **Next.js application on Vercel**, connected to a **hosted Supabase project**.

1. Apply Supabase migrations (`supabase db push` or CI).
2. Configure environment variables in Vercel (matching `.env.example`).
3. Deploy the `main` branch (or merge via pull request).
4. Verify auth, storage buckets, and RLS policies in Supabase.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full details.

---

## Related Documents

| Document                             | Contents                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| [VISION.md](./VISION.md)             | Product vision and positioning                                 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and data flows                             |
| [ROADMAP.md](./ROADMAP.md)           | Version roadmap                                                |
| [DEPLOYMENT.md](./DEPLOYMENT.md)     | Setup, deploy, rollback                                        |
| [CHANGELOG.md](./CHANGELOG.md)       | Version history                                                |
| [CLIENTS.md](./CLIENTS.md)           | Client companies and extractor plans                           |
| [INVOICING.md](./INVOICING.md)       | Invoice lifecycle, security, numbering and correction strategy |
