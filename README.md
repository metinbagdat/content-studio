# Content Studio

Private ops monorepo for **egitim.today** social + SEO content: source article → AI transforms → human approval → X / LinkedIn (more platforms planned).

Do not deploy this on the LearnCon Vercel Hobby project. Production: **`studio.egitim.today`** — see [docs/DEPLOY_PRODUCTION.md](docs/DEPLOY_PRODUCTION.md).

Tracking: [docs/ROADMAP.md](docs/ROADMAP.md) · Monorepo plan: [docs/MONOREPO.md](docs/MONOREPO.md) · Issues: [.github/ISSUE_INDEX.md](.github/ISSUE_INDEX.md) · DB changes: [docs/DATABASE.md](docs/DATABASE.md)

## Layout

| Path | Role |
|------|------|
| `apps/web/` | Next.js admin + API (`:3100`) |
| `apps/worker/` | Discovery cron + scheduled publish drain |
| `packages/db/` | Prisma schema, migrations, client export |
| `lib/` | Shared TS (stays at root until CS-M2 `packages/core`) |
| `legacy/emergent/` | Deprecated CRA + FastAPI (do not run daily) |

Root `package.json` is the single install/script entrypoint (`npm workspaces`).

## Stack

- Next.js 15 (App Router) — admin UI + API (`:3100`)
- Prisma + PostgreSQL
- BullMQ + Redis (optional; DB poll fallback)
- OpenAI-compatible / Groq LLM (optional; mocks if no key)

## Quick start (local)

```powershell
cd C:\Users\mb\content-studio
Copy-Item .env.example .env -ErrorAction SilentlyContinue
Copy-Item .env.example .env.local -ErrorAction SilentlyContinue

npm install
.\scripts\setup-db.ps1    # or Supabase — docs/SUPABASE_SETUP.md
npm run dev               # Docker + drain worker (exits when idle) + http://localhost:3100/admin
npm run worker:loop       # optional: 15s forever worker — local Docker only
```

### Admin

No email/password. Paste `ADMIN_API_KEY` (default `admin123`) into Admin API key fields.

### Faz 1 flow

1. Source (`/admin`) or Discovery (`/admin/discovery`)
2. Pipeline → captions / scripts
3. Approve (`/admin/review`) — `autoPublish` off
4. Connect accounts (`/admin/social`)
5. Calendar preview/apply (`/admin/calendar`)

## LearnCon vs this repo

| Concern | Repo |
|---------|------|
| Onboarding, referral, payments, student dashboard, site SEO | **learncon** |
| Blog → atomize → SM publish ops | **content-studio** |

## OAuth

Set `X_*` / `LINKEDIN_*` for real publish. Without them, dry-run accounts mock platform IDs.
