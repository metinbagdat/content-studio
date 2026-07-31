## Meta
- **ID:** CS-M1
- **Status:** todo
- **Repo:** content-studio
- **Depends on:** CS-M0

## Summary
Move active Next.js app and worker into `apps/*` under npm workspaces.

## Start when
- CS-M0 merged and local smoke passed

## Scope
- [ ] `apps/web`: `app/`, `lib/`, Next configs, Prisma (or keep Prisma until M2)
- [ ] `apps/worker`: worker entry + shared import path
- [ ] Root scripts: `dev`, `build`, `worker`, `db:*` via `-w`
- [ ] Update `AGENTS.md`, `README.md`, scripts (`setup-db.ps1`, discovery)

## Done when
- [ ] Fresh clone: `npm install` at root → `npm run dev` → `:3100/admin` OK
- [ ] `npm run worker` starts discovery cron + due-post drain
- [ ] CI/docs paths updated; no broken imports

## Out of scope
- Extracting `packages/db` (CS-M2)
- New social publishers
