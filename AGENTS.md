# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

- **Content Studio** monorepo root: Next.js 15 (App Router) admin UI + REST API on port **3100**, Prisma + PostgreSQL, optional worker.
- **Not LearnCon.** Growth/referral/onboarding/payments live in `metinbagdat/learncon`. See `docs/ROADMAP.md`.
- **Legacy Emergent** stack is under `legacy/emergent/{frontend,backend}` (CRA + FastAPI + Mongo). Do **not** run it unless a task explicitly says so.
- Future layout: `apps/web`, `apps/worker`, `packages/*` — plan in `docs/MONOREPO.md` (CS-M0/M1/M2).

### Services (dev)

- **PostgreSQL** (required): start before DB work (`sudo pg_ctlcluster 16 main start` on Cloud VM). Local Docker/Supabase: see `docs/SUPABASE_SETUP.md`.
- **Next.js**: `npm run dev` → http://localhost:3100/admin
- **Worker** (optional): `npm run worker` — discovery cron + scheduled publish drain. Empty `REDIS_URL` → DB poll fallback.

### Environment files

- `.env` / `.env.local` git-ignored. Copy from `.env.example`. Next reads `.env.local`; Prisma/worker read `.env`.
- Admin gate: `ADMIN_API_KEY` (default `admin123`) via `x-admin-key` / localStorage `cs_admin_key`.

### Database schema — drift caveat

- Migration `prisma/migrations/20260720190000_init` may miss newer `ContentType` enum values. After migrate, use `npx prisma db push` if pipeline errors on enum values.

### Lint / static checks

- `npm run lint` may prompt interactive ESLint setup — avoid non-interactively. Prefer `npm run typecheck` (`tsc --noEmit`) or `next build`.

### Tracking

- Roadmap: `docs/ROADMAP.md`
- Issue bodies: `.github/issue-bodies/` + `.github/ISSUE_INDEX.md`
