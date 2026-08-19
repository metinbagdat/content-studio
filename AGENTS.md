# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

- **Content Studio** monorepo root: Next.js 15 (App Router) admin UI + REST API on port **3100**, Prisma + PostgreSQL, optional worker.
- **Not LearnCon.** Growth/referral/onboarding/payments live in `metinbagdat/learncon`. See `docs/ROADMAP.md`.
- **Legacy Emergent** stack is under `legacy/emergent/{frontend,backend}` (CRA + FastAPI + Mongo). Do **not** run it unless a task explicitly says so.
- Layout: `apps/web` (Next), `apps/worker`, `packages/db` (Prisma). Shared app code still lives in root `lib/` until CS-M2 (`packages/core`). Plan: `docs/MONOREPO.md`.

### Services (dev)

- **PostgreSQL** (required): start before DB work (`sudo pg_ctlcluster 16 main start` on Cloud VM). Local Docker/Supabase: see `docs/SUPABASE_SETUP.md`.
- **Next.js**: `npm run dev` from repo root → Docker Postgres (if local URL) + drain worker (exits when queues idle) + http://localhost:3100/admin (`apps/web`)
- **Worker 24/7 loop** (optional): `npm run worker:loop` — do not point this at Supabase.

### Environment files

- `.env` / `.env.local` at **repo root** (git-ignored). Copy from `.env.example`. Next loads them via `apps/web/next.config.js`; Prisma/worker read `.env`.
- Admin gate: `ADMIN_API_KEY` (default `admin123`) via `x-admin-key` / localStorage `cs_admin_key`.

### Database schema — drift caveat

- Schema: `packages/db/prisma/schema.prisma`. Root `package.json` `"prisma.schema"` points here so `npx prisma …` from root works.
- Migration `packages/db/prisma/migrations/20260720190000_init` may miss newer `ContentType` enum values. After migrate, use `npx prisma db push` if pipeline errors on enum values.

### Lint / static checks

- `npm run lint` may prompt interactive ESLint setup — avoid non-interactively. Prefer `npm run typecheck` or `next build`.
- Web typecheck: `apps/web/tsconfig.json`. Worker/scripts/lib: root `tsconfig.json` (excludes `apps/web`).

### Deploy

- `vercel.json` stays at repo root. Do **not** set Vercel Root Directory to `apps/web` unless install/env are also pointed at the monorepo root. Next `distDir` is repo-root `.next` so GHA `vercel build` still traces `lib/` + `packages/db`.

### Tracking

- Roadmap: `docs/ROADMAP.md`
- Issue bodies: `.github/issue-bodies/` + `.github/ISSUE_INDEX.md`
