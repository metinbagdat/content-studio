# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

- **Content Studio** monorepo root: Next.js 15 (App Router) admin UI + REST API on port **3100**, Prisma + PostgreSQL, optional worker.
- **Not LearnCon.** Growth/referral/onboarding/payments live in `metinbagdat/learncon`. See `docs/ROADMAP.md`.
- **Legacy Emergent** stack is under `legacy/emergent/{frontend,backend}` (CRA + FastAPI + Mongo). Do **not** run it unless a task explicitly says so.
- Layout: `apps/web` (Next), `apps/worker`, `packages/db` (Prisma). Shared app code still lives in root `lib/` until CS-M2 (`packages/core`). Plan: `docs/MONOREPO.md`.

### Services (dev)

- **PostgreSQL** (required): the Cloud VM has **no Docker and no PostgreSQL preinstalled** — `npm run dev`'s `predev` hook (`scripts/ensure-local-docker.ts`) shells out to `docker`, which does not exist here. One-time setup:
  ```bash
  sudo apt-get update -qq && sudo apt-get install -y -qq postgresql
  sudo pg_ctlcluster 16 main start
  sudo -u postgres psql -c "CREATE ROLE content WITH LOGIN PASSWORD 'content' SUPERUSER;"
  sudo -u postgres psql -c "CREATE DATABASE content_studio OWNER content;"
  ```
  Then set `DATABASE_URL="postgresql://content:content@127.0.0.1:5432/content_studio?schema=public"` in `.env`/`.env.local` (port **5432**, not the Docker Compose port 5434 from `.env.example`), and run `npx prisma db push`.
  If the pod is later recreated, PostgreSQL must be reinstalled/restarted — it is not part of the base image.
- **Next.js**: run with `SKIP_LOCAL_DOCKER=true npm run dev` from repo root — the flag skips the Docker-only `predev`/`preworker` checks (they only make sense on the maintainer's Windows+Docker Desktop box) and go straight to the drain worker (exits when queues idle) + http://localhost:3100/admin (`apps/web`). Without the flag, `npm run dev`/`npm run worker` fail fast on this VM.
- **Worker 24/7 loop** (optional): `SKIP_LOCAL_DOCKER=true npm run worker:loop` — do not point this at Supabase.

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
