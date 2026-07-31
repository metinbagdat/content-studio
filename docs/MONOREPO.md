# Content Studio Monorepo Plan

## Goal

One root `package.json` orchestrates install/scripts. Active code is Next.js + worker + Prisma. Legacy Emergent (CRA + FastAPI) is quarantined, not deleted in M0.

## Target layout

```
content-studio/
  package.json              # workspaces root
  apps/
    web/                    # Next.js admin + API  (M1)
    worker/                 # BullMQ / cron worker  (M1)
  packages/
    db/                     # Prisma schema + client (M2)
    core/                   # shared lib extract    (M2)
  legacy/
    emergent/
      frontend/             # CRA — deprecated (M0)
      backend/              # FastAPI — deprecated (M0)
  docs/
  .github/issue-bodies/
```

## Phases

### M0 — Foundation (this PR)
- Fix root `.gitignore` (remove merge conflict markers).
- Quarantine `frontend/` + `backend/` → `legacy/emergent/`.
- Root `package.json`: `private` workspaces + clear scripts (dev/worker/db still run from root until M1).
- Scaffold `apps/` + `packages/` with README placeholders.
- Roadmap + issue bodies with start/done criteria.

**Done when:** `npm run dev` on port 3100 still works; legacy not on default path.

### M1 — Apps layout
- Move `app/`, `lib/`, `prisma/`, `workers/`, Next configs into `apps/web` (and/or `apps/worker`).
- Root scripts: `npm run dev -w @content-studio/web`.
- Update `AGENTS.md`, Docker/scripts paths.

**Done when:** clean clone + `npm install` + `npm run dev` from root.

### M2 — Shared packages
- Extract Prisma → `packages/db`.
- Extract selected `lib/*` → `packages/core` as imports stabilize.

**Done when:** web + worker depend on workspace packages only for DB/shared types.

## Non-goals
- Merging LearnCon into this monorepo.
- Running Emergent stack by default.
- Deploying Content Studio on LearnCon Vercel Hobby.
