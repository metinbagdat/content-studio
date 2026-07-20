# Content Studio

Private ops tool for **egitim.today** social + SEO content: source article → AI transforms → human approval → X / LinkedIn schedule/publish.

**Not** part of LearnCon (`metinbagdat/learncon`). Do not deploy this on the LearnCon Vercel Hobby project.

## Stack

- Next.js 15 (App Router) — admin UI + API (`:3100`)
- Prisma + PostgreSQL
- BullMQ + Redis (optional; DB job poll fallback works without Redis)
- OpenAI-compatible API (optional; mocks if no key)

## Quick start (local)

**Docker Hub hesabı / repo gerekmez.** `postgres` ve `redis` imajları public Hub’dan çekilir; senin `metinbagdat` altında boş repo listesi normal.

**Gereken:** Docker **Desktop** (WSL2 + Ubuntu). Engine açılmazsa:

```powershell
# Yönetici PowerShell
wsl --install -d Ubuntu
# Restart sonrası Ubuntu’yu bir kez aç, Docker Desktop’ı başlat
docker info   # Server Version görünmeli
```

Sonra:

```powershell
cd C:\Users\mb\content-studio
# .env / .env.local zaten varsa atla
Copy-Item .env.example .env -ErrorAction SilentlyContinue
Copy-Item .env.example .env.local -ErrorAction SilentlyContinue

npm install
.\scripts\setup-db.ps1    # compose up + prisma migrate deploy
npm run dev               # http://localhost:3100/admin
npm run worker            # ayrı terminal (opsiyonel; sync pipeline API’de çalışır)
```

Admin key = `.env` içindeki `ADMIN_API_KEY`.


## Faz 1 flow

1. Add source article (`/admin`)
2. Start pipeline → SOCIAL_CAPTION, VIDEO_SCRIPT, PODCAST_SCRIPT, BLOG_POST (text only)
3. Approve on `/admin/review` (`autoPublish` always false)
4. Connect dry-run or OAuth accounts on `/admin/social`
5. Publish now or schedule; calendar on `/admin/calendar`

## OAuth

Set `X_CLIENT_ID` / `X_CLIENT_SECRET` and LinkedIn equivalents for real publish. Without them, dry-run accounts publish mock platform IDs.

## LearnCon

Docs only: update `docs/CONTENT_STUDIO_FINAL_PLAN.md` in learncon. No SM code in learncon.
