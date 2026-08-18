## Meta
- **ID:** CS-M0
- **Status:** doing
- **Repo:** content-studio

## Summary
Monorepo foundation: root workspaces orchestration, quarantine legacy Emergent stack, tracking docs.

## Start when
- Active Next.js app runs on `:3100`
- Dual stacks (`frontend/` + `backend/` vs `app/`) cause confusion

## Scope
- [x] Resolve `.gitignore` merge conflict
- [x] Move Emergent `frontend/` + `backend/` → `legacy/emergent/`
- [x] Root `package.json` workspaces + script aliases
- [x] Scaffold `apps/` + `packages/`
- [x] `docs/ROADMAP.md` + `docs/MONOREPO.md` + issue index

## Done when
- [x] `npm run dev` serves `/admin` without path changes for operators
- [x] README/AGENTS document legacy vs active paths
- [x] No requirement to `cd frontend` for daily work

## Out of scope
- Moving Next into `apps/web` (CS-M1)
- LearnCon growth features
