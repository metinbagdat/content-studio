## Meta
- **ID:** CS-M2
- **Status:** todo
- **Repo:** content-studio
- **Depends on:** CS-M1

## Summary
Extract stable shared modules from root `lib/` into `packages/core`. Prisma already lives in `packages/db` (CS-M1).

## Start when
- **Deferred.** CS-M1 already merged (`apps/web`, `apps/worker`, `packages/db`). Root `lib/` is **intentional** until this issue: web maps `@/lib/*` → `../../lib/*`. `packages/core` is planned only (`packages/README.md`) — it is **not** a half-finished migration. Do **not** extract early.

## Scope
- [ ] `packages/core` — auth helper, platforms limits/formats (as needed)
- [ ] Web + worker import shared types from workspace packages
- [ ] Remove or thin root `lib/` after the extract

## Done when
- [ ] No duplicated Prisma client generation hacks
- [ ] Typecheck/build from root succeeds
- [ ] Root `lib/` is gone or a thin re-export layer
