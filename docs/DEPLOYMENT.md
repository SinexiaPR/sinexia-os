# Deployment

Guide for local setup, Supabase configuration, Vercel deployment, and production operations.

---

## Local Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd sinexia-os
npm install
```

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in all required variables (see [README.md](./README.md#environment-variables)).

### 3. Supabase

Link your local CLI to the project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Verify in the Supabase dashboard:

- Auth enabled (email provider)
- Storage buckets: `documents`, `reports`
- RLS policies active on all public tables

### 4. Seed development users (optional)

```bash
npm run seed:users
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### 5. Run locally

```bash
npm run dev
```

---

## Supabase

### Migrations

All schema changes live in `supabase/migrations/`. Apply in order:

```bash
npx supabase db push
```

For production, apply migrations **before** deploying application code that depends on new schema.

### Storage buckets

| Bucket | Access |
|--------|--------|
| `documents` | Private — clients upload, admins read |
| `reports` | Private — admins upload, clients read |

Bucket policies are defined in migrations. Do not make buckets public.

### Auth

- Email/password authentication
- User metadata: `role`, `company_id`, `full_name`
- Profile sync via database trigger on signup

### Service role key

Used only server-side for:

- Document intelligence processing
- Notification trigger inserts (via `SECURITY DEFINER` functions)
- Seed scripts

**Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or `NEXT_PUBLIC_*` variables.

---

## Vercel

### Project setup

1. Import the GitHub repository in Vercel
2. Framework preset: **Next.js**
3. Root directory: `/` (default)
4. Build command: `npm run build`
5. Output: Next.js default

### Environment variables

Add in Vercel → Settings → Environment Variables:

| Variable | Environments |
|----------|--------------|
| `NEXT_PUBLIC_APP_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only (Preview optional) |
| `OPENAI_API_KEY` | Production, Preview |
| `NEXT_PUBLIC_SINEXIA_URL` | Production, Preview |

Use production Supabase credentials for Production; a separate Supabase project (or branch) for Preview is recommended.

### Domains

Configure custom domain in Vercel and update `NEXT_PUBLIC_APP_URL` to match.

Add the production URL to Supabase Auth → URL Configuration (redirect URLs).

---

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `feature/*` | Feature development |
| `docs/*` | Documentation updates |

### Standard flow

1. Create branch from `main`
2. Develop and open Draft PR
3. CI/build must pass (`npm run build`)
4. Review and merge to `main`
5. Vercel auto-deploys `main` to production

Do not push secrets. Use `.env.local` locally and Vercel env vars in deployed environments.

---

## Production Deployment

### Pre-deploy checklist

- [ ] Migrations applied to production Supabase
- [ ] Environment variables set in Vercel
- [ ] `OPENAI_API_KEY` valid and funded
- [ ] Supabase Auth redirect URLs include production domain
- [ ] Storage buckets and RLS verified
- [ ] `npm run build` passes on the release branch

### Deploy

Merging to `main` triggers Vercel production deployment automatically.

Monitor:

- Vercel deployment logs
- Supabase Auth logs
- Application runtime logs (Vercel Functions)

### Post-deploy smoke test

1. Admin login → inbox loads
2. Client login → dashboard loads
3. Document upload succeeds
4. Report view/download works
5. SinexIA responds to a test question
6. Logout redirects to `/login`; `/dashboard` requires auth

---

## Rollback

### Application rollback (Vercel)

1. Open Vercel → Deployments
2. Find the last known-good deployment
3. Click **Promote to Production**

This reverts application code instantly without touching the database.

### Database rollback

Supabase migrations are forward-only in production. To revert schema changes:

1. Write a compensating migration (preferred)
2. Or restore from Supabase point-in-time recovery (if enabled on your plan)

**Never** run destructive SQL manually in production without a backup.

### Recommended rollback order

1. Roll back Vercel deployment first (fastest, lowest risk)
2. Assess whether a database migration rollback is needed
3. If yes, deploy a compensating migration — do not delete production data ad hoc

---

## Related

- [README.md](./README.md) — local development overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system components
- [CHANGELOG.md](./CHANGELOG.md) — version history
