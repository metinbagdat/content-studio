# Content Studio

Private ops tool for **egitim.today** social + SEO content: source article -> AI transforms -> human approval -> X / LinkedIn schedule/publish.

**Not** part of LearnCon (`metinbagdat/learncon`). Do not deploy this on the LearnCon Vercel Hobby project.

## Stack

- Next.js 15 (App Router) - admin UI + API (`:3100`)
- Prisma + PostgreSQL
- BullMQ + Redis (optional; DB job poll fallback works with DB polling)
- OpenAI-compatible API (optional; mocks if no key)

## Quick start (local)

**Docker Hub account / empty repo list is fine** - `postgres` and `redis` images are public.

**If Docker Desktop fails** (WSL2, `docker info` errors, or port conflicts), use **Supabase Postgres** instead of local compose. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md):

1. Create or open project **egitim-content-studio** (ref in docs).
2. Copy **Session pooler** URI (port 5432) into `.env` and `.env.local` as `DATABASE_URL`.
3. Set `REDIS_URL=""` (optional Redis; app falls back to DB polling).
4. `npx prisma migrate deploy` then `npm run dev`.

**Docker path** (when engine is healthy):

```powershell
# Admin PowerShell if WSL missing
wsl --install -d Ubuntu
# After restart: open Ubuntu once, start Docker Desktop
docker info   # Server Version should appear
```

Then:

```powershell
cd C:\Users\mb\content-studio
# Skip if .env / .env.local already exist
Copy-Item .env.example .env -ErrorAction SilentlyContinue
Copy-Item .env.example .env.local -ErrorAction SilentlyContinue

npm install
.\scripts\setup-db.ps1    # compose up + prisma migrate deploy
npm run dev               # http://localhost:3100/admin
npm run worker            # separate terminal (optional; sync pipeline runs in API)
```

### Admin giriş (Next.js `:3100/admin`)

Bu uygulama e-posta/şifre login kullanmaz. Admin alanındaki **Admin API key** alanına `.env` / `.env.local` içindeki `ADMIN_API_KEY` değerini yazın.

- Varsayılan (`.env.example`): `admin123`
- Eski kopyalarda hâlâ `dev-admin-change-me` olabilir — o zaman ya o değeri kullanın ya da her iki dosyada `ADMIN_API_KEY=admin123` yapıp `npm run dev` yeniden başlatın
- Tarayıcıda eski yanlış key kaldıysa: DevTools → Application → Local Storage → `cs_admin_key` silin

(`frontend/` + `backend/` altındaki JWT login / `admin@egitim.today` + `admin123` eski Emergent stack’tir; `npm run dev` onu çalıştırmaz.)

## Faz 1 flow

1. Add source article (`/admin`) — or run discovery (`/admin/discovery`, worker cron 06:00 IST)
2. Start pipeline -> SOCIAL_CAPTION, VIDEO_SCRIPT, PODCAST_SCRIPT, BLOG_POST (text only)
3. Approve on `/admin/review` (`autoPublish` always false)
4. Connect dry-run or OAuth accounts on `/admin/social`
5. Preview/apply 14-day distribution on `/admin/calendar`; publish now or wait for worker

## Faz 2a — Podcast MP3

1. Approve `PODCAST_SCRIPT` on `/admin/review`
2. **Ses üret** → `/admin/media` → MP3 + in-browser player
3. TTS: Edge (free) or `TTS_PROVIDER=openai` + real OpenAI key (not Groq)

See [docs/FAZ2_MEDIA.md](docs/FAZ2_MEDIA.md) for video/song roadmap.

## OAuth

Set `X_CLIENT_ID` / `X_CLIENT_SECRET` and LinkedIn equivalents for real publish. Without them, dry-run accounts publish mock platform IDs.

## LearnCon

Docs only: update `docs/CONTENT_STUDIO_FINAL_PLAN.md` in learncon. No SM code in learncon.
