## Meta
- **ID:** CS-M2
- **Status:** done
- **Repo:** content-studio
- **Depends on:** CS-M1

## Summary
Extract stable shared modules from root `lib/` into `packages/core`. Prisma already lives in `packages/db` (CS-M1).

## Start when
- CS-M1 merged (`apps/web`, `apps/worker`, `packages/db`).

## Scope
- [x] `packages/core` — auth helper, adminKey, platforms limits/formats/targets
- [x] Web + worker import shared types from workspace packages
- [x] Remove or thin root `lib/` after the extract — thinned: auth/platforms → core; bulk `lib/` remains for later phases

## Done when
- [x] No duplicated Prisma client generation hacks (unchanged — still single `@content-studio/db`)
- [x] Typecheck/build from root succeeds
- [x] Root `lib/` thinned — auth/platforms extracted; not fully deleted (by design for phased M2)

## Notes
- `lib/platforms/targets.selftest.ts` stays in `lib/` (depends on `lib/audience/segments`)
- `next.config.js` `transpilePackages` includes `@content-studio/core` for Vercel production build
- Runbook: `cs-m2-migrate.ps1` (or `scripts/cs-m2-finish-codemod.mjs` for codemod-only recovery)
- Verified: `npm run build` green on main (2026-08-23)
