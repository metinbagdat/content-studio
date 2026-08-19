# Content Studio Monorepo Plan

## Goal

One root `package.json` orchestrates install/scripts. Active code is Next.js + worker + Prisma. Legacy Emergent (CRA + FastAPI) is quarantined, not deleted in M0.

## Layout

```
content-studio/
  package.json              # workspaces root (dev/build/worker/db:*)
  apps/
    web/                    # Next.js admin + API
    worker/                 # BullMQ / cron entry (chdir repo root)
  packages/
    db/                     # Prisma schema + client (M1)
    core/                   # planned only (M2) — directory does not exist yet
  lib/                      # shared TS until CS-M2 (intentional; not leftover)
  legacy/
    emergent/
      frontend/             # CRA — deprecated (M0)
      backend/              # FastAPI — deprecated (M0)
  docs/
  .github/issue-bodies/
```

Daily commands stay at repo root: `npm run dev`, `npm run worker`, `npx prisma …`.

## Phases

### M0 — Foundation
- Fix root `.gitignore` (remove merge conflict markers).
- Quarantine `frontend/` + `backend/` → `legacy/emergent/`.
- Root `package.json`: `private` workspaces + scripts.
- Scaffold `apps/` + `packages/` with README placeholders.
- Roadmap + issue bodies with start/done criteria.

**Done when:** `npm run dev` on port 3100 still works; legacy not on default path.

### M1 — Apps layout + Prisma package
- Move `app/`, `components/`, `public/`, Next configs → `apps/web`.
- Move worker entry → `apps/worker` (keep `process.chdir` to repo root so `storage/` stays at root).
- Move `prisma/` → `packages/db/prisma`; client export `@content-studio/db`. Root `lib/prisma.ts` re-exports.
- Keep `lib/` at repo root until CS-M2.
- Root scripts: `npm run dev -w @content-studio/web`.
- Vercel: `vercel.json` at repo root; Next `distDir` + `outputFileTracingRoot` so GHA `vercel build` still works. Do not set dashboard Root Directory to `apps/web` without also fixing install/env.

**Done when:** clean clone + `npm install` + `npm run dev` from root; `npm run worker` ticks; Prisma CLI uses `packages/db/prisma/schema.prisma`.

### M2 — Shared core
- Extract selected `lib/*` → `packages/core` as imports stabilize.
- Prisma already lives in `packages/db` (done in M1).

**Done when:** web + worker depend on workspace packages for DB and shared types; root `lib/` is gone or thin.

## Non-goals
- Merging LearnCon into this monorepo.
- Running Emergent stack by default.
- Deploying Content Studio on LearnCon Vercel Hobby.
