# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

- The active product is **Content Studio**: a Next.js 15 (App Router) admin UI + REST API on port **3100**, backed by Prisma + PostgreSQL. Standard commands live in `README.md` and `package.json` scripts.
- `frontend/` + `backend/` is a **deprecated** legacy Emergent stack (React CRA + FastAPI + MongoDB). `npm run dev` does **not** run it; ignore it unless a task explicitly targets it.

### Services (dev)

- **PostgreSQL** (required): a local cluster is installed. Start it before doing anything DB-related:
  `sudo pg_ctlcluster 16 main start`
  Dev connection (already set in `.env`/`.env.local`): role `content` / password `content`, database `content_studio` on `127.0.0.1:5432`.
- **Next.js dev server** (required): `npm run dev` → http://localhost:3100/admin
- **Redis / worker** (optional): `REDIS_URL` is empty, so BullMQ falls back to DB polling. `npm run worker` is only needed for scheduled auto-publish.

### Environment files

- `.env` and `.env.local` are git-ignored and hold the local `DATABASE_URL`. They persist in the VM snapshot, not via git. If they are ever missing, recreate them from `.env.example` and set `DATABASE_URL="postgresql://content:content@127.0.0.1:5432/content_studio?schema=public"`. Next.js reads `.env.local`; Prisma/worker read `.env`.

### Database schema — non-obvious drift caveat

- The committed migration `prisma/migrations/20260720190000_init` is **out of sync** with `prisma/schema.prisma`: its `ContentType` enum is missing `TWITTER_THREAD`, `LINKEDIN_CAROUSEL`, and `SHORT_VIDEO_SCRIPT`. If you only run `prisma migrate deploy`, the content pipeline fails at runtime with `invalid input value for enum "ContentType": "TWITTER_THREAD"`.
- To get a working dev DB, reconcile the schema after migrating: `npx prisma db push` (or just use `npx prisma db push` on a fresh DB). This does not modify the committed migration.

### Admin auth

- No email/password login. In the `/admin` UI, put the `ADMIN_API_KEY` value (default `admin123`) into the "Admin API key" field; it is sent as the `x-admin-key` header and cached in `localStorage` as `cs_admin_key`. APIs return 401 without it.

### Lint / static checks

- `npm run lint` is **not** configured (no ESLint config or dependency) and will drop into Next.js's interactive ESLint setup — do not run it non-interactively. Use `npx tsc --noEmit` for a static check; `next build` also type-checks.
