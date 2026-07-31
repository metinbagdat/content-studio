# Legacy Emergent stack (deprecated)

Quarantined from the active Content Studio (Next.js + Prisma).

| Path | Stack |
|------|--------|
| `frontend/` | React CRA + JWT login (`admin@egitim.today` / `admin123`) |
| `backend/` | FastAPI + MongoDB |
| `.emergent/` | Emergent cron/deploy helpers |

**Do not** use for daily ops. Active app: repo root / future `apps/web` → `npm run dev` → `:3100/admin` with `ADMIN_API_KEY`.

Kept for reference only; may be deleted after CS-M1+ confirmation.
