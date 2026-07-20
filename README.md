# Content Studio

Private ops tool for **egitim.today** social + SEO content: source article → AI transforms → human approval → X / LinkedIn schedule/publish.

**Not** part of LearnCon (`metinbagdat/learncon`). Do not deploy this on the LearnCon Vercel Hobby project.

## Stack

- Next.js 15 (App Router) — admin UI + API (`:3100`)
- Prisma + PostgreSQL
- BullMQ + Redis (optional; DB job poll fallback works without Redis)
- OpenAI-compatible API (optional; mocks if no key)

## Quick start (local)

```bash
# 1) Docker Desktop açıkken
docker compose up -d

# 2) Env
cp .env.example .env
cp .env.example .env.local

# 3) Install + DB
npm install
npx prisma migrate dev --name init
# or: npm run db:push

# 4) App + worker
npm run dev
npm run worker
```

Admin: http://localhost:3100/admin — header/key = `ADMIN_API_KEY` from `.env`.

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
