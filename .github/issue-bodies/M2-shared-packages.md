## Meta
- **ID:** CS-M2
- **Status:** todo
- **Repo:** content-studio
- **Depends on:** CS-M1

## Summary
Extract Prisma and stable shared modules into workspace packages.

## Start when
- CS-M1 merged; import graph stable for 1+ week of local use

## Scope
- [ ] `packages/db` — schema, migrations, client export
- [ ] `packages/core` — auth helper, platforms limits/formats (as needed)
- [ ] Web + worker depend on workspace packages

## Done when
- [ ] No duplicated Prisma client generation hacks
- [ ] Typecheck/build from root succeeds
