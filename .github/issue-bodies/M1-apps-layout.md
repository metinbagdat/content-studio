## Meta
- **ID:** CS-M1
- **Status:** doing
- **Repo:** content-studio
- **Depends on:** CS-M0

## Summary
Move active Next.js app and worker into `apps/*`, and Prisma into `packages/db`, under npm workspaces.

## Start when
- CS-M0 merged and local smoke passed

## Scope
- [x] `apps/web`: `app/`, `components/`, `public/`, Next configs (`lib/` stays at repo root until M2)
- [x] `apps/worker`: worker entry + `chdir` to repo root for `storage/`
- [x] `packages/db`: schema, migrations, `@content-studio/db` client
- [x] Root scripts: `dev`, `build`, `worker`, `db:*` via `-w` / Prisma schema path
- [x] Update `AGENTS.md`, `README.md`, `docs/MONOREPO.md`, scripts (`setup-db.ps1`, `db-execute.ps1`)

## Done when
- [ ] Fresh clone: `npm install` at root → `npm run dev` → `:3100/admin` OK
- [ ] `npm run worker` starts discovery cron + due-post drain
- [ ] CI/docs paths updated; no broken imports

## Out of scope
- Extracting `packages/core` (CS-M2)
- New social publishers
