# egitim.today — Growth & Content Roadmap (Tracking)

Canonical tracker for **two repos**. Do not implement LearnCon product code inside Content Studio.

| Repo | Role |
|------|------|
| `metinbagdat/learncon` | Product: auth, payment, onboarding, referral, dashboard, SEO site |
| `metinbagdat/content-studio` | Ops tool: blog → atomize → approve → publish to social (this repo) |

Issue bodies: `.github/issue-bodies/`. GitHub Issues API may be restricted; open issues from those files manually when needed.

Status legend: `todo` · `doing` · `done` · `blocked` · `learncon` (tracked in learncon)

---

## A. Content Studio — SM content engine (this repo)

| ID | Title | Status | Start when | Done when |
|----|-------|--------|------------|-----------|
| CS-M0 | Monorepo foundation (workspaces + legacy quarantine) | doing | Roadmap approved | Root workspaces; legacy under `legacy/`; `npm run dev` still works |
| CS-M1 | Move Next app → `apps/web`, worker → `apps/worker` (+ Prisma merge) | done | CS-M0 merged | #43 merged; `apps/web` + `apps/worker` + `packages/db` |
| CS-M2 | Shared packages (`packages/core`) | todo | **defer** — root `lib/` is intentional until then | Extract selected `lib/*` → `packages/core`; `packages/core` does **not** exist yet (not a half-finished move) |
| CS-00 | Discovery cron + admin UI | done | — | `/admin/discovery` + worker 06:00 IST |
| CS-01 | Atomization → ~50 derivatives | done | — | Counts match plan; THREAD/CAROUSEL/SHORT_VIDEO/INFOGRAPHIC stored |
| CS-02 | Platform captions (X, LI, IG, TT, YT, FB, Pin) | done | — | Formatters + limits per platform, reviewable with platform badge |
| CS-03 | Image generation (cards / thumbs) | doing | CS-02 | Cards now render at correct per-platform size/aspect ratio; DALL-E art variant still open (paid API) |
| CS-04 | Audio / music (TTS, march/song) | doing | CS-03 | Podcast jingles + march/song TTS+music bed done; Suno/Udio sung audio open |
| CS-05 | Podcast packaging | doing | CS-04 | Segments + timeline + jingles; long articles → 2–3 bölüm (`lib/media/podcastEpisodes.ts`) |
| CS-06 | Publishers: IG / TikTok / YT / FB / Pinterest | doing | OAuth apps ready | YouTube local publish verified (Shorts + long); X/LI local OK; Meta/TikTok App Review / prod OAuth still open; Pinterest API later |
| CS-07 | Distribution calendar apply | done | — | `/admin/calendar` preview + apply; weekday-preferred, weekend-reduced cadence |
| CS-08 | Performance feedback loop | doing | Metrics API access | X/LI/FB post analytics + Takvim adaptive slot raporu; ≥5 örnekte saat kayar |
| CS-09 | FFmpeg short video | doing | Media storage ready | 9:16 burn-in + SRT wrap/sidecar; TikTok/Reels OAuth hâlâ açık |
| CS-10 | Image resize per platform | done | CS-03 | Batch JPEG export from master via sharp; template cards render direct per size |
| CS-11 | Infographic text format | done | CS-01 | Bullet/stat copy + 5-point ImageResponse PNG (`generateInfographicImage`); DALL-E optional later |
| CS-SM-01 | Audience segments (TYT/AYT/LGS/veli) | done | CS-SM-EPIC | Core done (tags, hashtags, platform order, Onay filter, LLM-on-genel). Sosyal panel polish → [#56](https://github.com/metinbagdat/content-studio/issues/56) (CS-SM-01b) |
| CS-WP | WordPress SEO hub bridge | doing | wp-seo-hub repo | TT4 + Rank Math; **7 live articles** (#15/#20 + #23–#27). Next: Rank Math wizard + GSC *property* (manual). OAuth = CS-WP-03b **only after impressions** |
| CS-WP-03b | GSC OAuth refresh (durable token) | todo | GSC shows **impressions** (not “posts exist”) | Store refresh token like X/LI; stop pasting `GSC_ACCESS_TOKEN`. Published ≠ indexed ≠ queries |
| CS-WP-04 | WP publish → SM webhook | doing | CS-WP | `POST /api/webhooks/wordpress-published` live |
| CS-WP-05 | Canonical blog is WordPress | doing | WP live | Discovery = WP sitemap; 5 LearnCon long-forms on WP; LC 301s **merged** [#1328](https://github.com/metinbagdat/learncon/pull/1328) |
| CS-EM-01 | Hostinger Reach contact API | doing | Reach token **after GSC impressions** (corpus OK; wait on search signal) | `lib/email/hostingerReach.ts` + `POST /api/email/reach`; live sync needs `HOSTINGER_API_TOKEN` |
| CS-EM-02 | Admin e-posta sayfası | doing | CS-EM-01 | `/admin/email` kişi ekle / liste |
| CS-EM-03 | WP yayın → bülten hatırlatması | todo | 3–5 posts + CS-EM-01 | Kampanya send API yok; Onay/WP sonrası Reach’te manuel gönder hatırlatması |

Detail files: `01-discovery-cron.md` … `12-infographic-format.md`, plus `M0-monorepo.md`, `M1-apps-layout.md`.

---

## B. LearnCon — Growth engine (NOT this repo)

Implement in `metinbagdat/learncon`. Listed here so the growth doc has a single checklist.

| ID | Title | Status | Sprint | Done when |
|----|-------|--------|--------|-----------|
| LC-G0 | Auth & checkout login-loop | learncon | 0–2 | Checkout resumes after login |
| LC-G1 | Registration conversion page | learncon | 1 | “Neden eğitim.today?” + CTA live |
| LC-G2 | Onboarding 6-question → AI plan | learncon | 3 | First value in-session |
| LC-G3 | Dashboard MVP widgets | learncon | 4 | Focus / tasks / streak / upsell |
| LC-G4 | Email/SMS/WhatsApp automations | learncon | 5 | SendGrid/Twilio — **not** Hostinger Reach (blog newsletter is CS-EM) |
| LC-G5 | Referral program | learncon | 6–7 | Invite link + reward/XP |
| LC-G6 | SEO topic clusters + OG cards | learncon | **now (with blog)** | Pillar pages on `egitim.today` that match `blog.egitim.today` clusters + OG |
| LC-G7 | Broadcast panel (admin/teacher) | learncon | 6–7 | Telegram/WA/email blast |
| LC-G8 | Motivation / school score engine | learncon | 8 | Target progress widgets |
| LC-G9 | Admin payment ops panel | learncon | 9–10 | Orders ops + taxonomy |

---

## C. Boundary rules (safety)

1. **No LearnCon deploy** of Content Studio on Vercel Hobby (quota).
2. Content Studio **admin key** auth only — not LearnCon JWT/session.
3. Growth/referral/onboarding PRs go to **learncon**.
4. Content Studio PRs must not add product signup/pay code.
5. Monorepo moves are **phased** (M0 → M1 → M2); no big-bang delete of working `app/`.

---

## D. Near-term sequence (marketing first)

Blog + SEO is demand generation for `egitim.today`. Ahead of CS-M2, DALL-E, Meta App Review, sung audio, Pinterest.

**Do not use Soro (trysoro.com) as the blog engine.** It auto-publishes and has no keyword metrics API. CS-WP-03 is GSC + optional DataForSEO later. If Soro is ever tried: dashboard **Draft only**, never auto-publish, and never a second writer next to Content Studio.

Do **not** put LearnCon product code in this repo. LC-G6 still lands in `metinbagdat/learncon`.

| # | Work | Status |
|---|------|--------|
| 1 | Real blog, not Hostinger AI / TT4 Études demo | **done** 2026-08-18: Twenty Twenty-Four, static home + CTA → `egitim.today` |
| 2 | Technical SEO | Rank Math **plugin active**; sitemap OK (`sitemap_index.xml` / `post-sitemap.xml`). **Still you:** Rank Math setup wizard + GSC *property* verified (sitemap submitted). This is **not** Studio OAuth |
| 3 | First real articles | **done (corpus):** WP **#15, #20, #23–#27** (7 articles). Canonical = `blog.egitim.today`. LearnCon `/blog` = Haberler only; 301s **merged** [learncon#1328](https://github.com/metinbagdat/learncon/pull/1328) |
| 4 | Every post CTA → `egitim.today` | Homepage CTA live; keep on every article |
| 5 | Topic engine (HPV) | **code done:** DataForSEO + optional GSC overlay. `fetchGscQueries()` = last **28 days** of *queries*. Empty rows are normal until Google indexes + shows impressions. **Do not build CS-WP-03b** until GSC UI has non-zero queries/impressions |
| 6 | Product-site clusters + OG | LearnCon **LC-G6** (pulled forward) |
| 7 | Publish webhook → SM | Live: WP ingest path exists; LI partial; YT/TT upload still open — [#47](https://github.com/metinbagdat/content-studio/issues/47) |
| 8 | SM → SEO wiring | Canonical URL on captions [#48](https://github.com/metinbagdat/content-studio/issues/48); YouTube durable MP4 [#49](https://github.com/metinbagdat/content-studio/issues/49) |
| 9 | Reach newsletter | Corpus size OK; wait for **search signal** (same gate as GSC OAuth), then token |
| 10 | LearnCon `/blog` → WP | **done decision + migrate + 301s.** Long-form only on WP |

### GSC / Rank Math / OAuth — what each actually does

| Piece | Who | What it does | Do now? |
|-------|-----|--------------|---------|
| Rank Math wizard | You (WP admin) | Titles/meta, sitemaps, connect Google (plugin UX). Helps crawl/index hygiene | **Yes** if not finished |
| GSC *property* | You | Verifies `blog.egitim.today`, sitemap submit, Performance UI. Source of truth for “is there data?” | **Yes** — check Performance → Queries |
| `GSC_ACCESS_TOKEN` paste | Ops, optional | One-shot Bearer so Studio can call Search Analytics API | Only to **smoke-test** once UI shows rows |
| **CS-WP-03b OAuth** | Code | Stores refresh token → Studio can call `fetchGscQueries` on HPV cron **without** pasting a token every ~1h | **No until** GSC UI has impressions. Automates **token refresh**, not ranking |

**What OAuth concretely automates (and does not):** Overnight / admin HPV scan already can overlay real search queries onto topic scores (`gscBoostForTitle`). Today that needs a short-lived access token in env. OAuth only makes that call **durable** (like X/LI). It does **not** invent keywords if Google has zero impressions; it does **not** replace DataForSEO volume; it does **not** fix Rank Math or indexing.

**Gate:** open GSC → Performance → last 28 days. If Queries is empty, OAuth skeleton = plumbing with no payload — defer next to CS-M2 / DALL-E / Suno (still correctly parked). Track checklist: `docs/GSC_READINESS.md`.

**Defer (unchanged):** CS-M2, CS-03 DALL-E art, CS-04 Suno, CS-06 Meta/TikTok App Review, Pinterest, **CS-WP-03b until impressions**.

### CS-M1(+Prisma) (merged #43)

```bash
git checkout -b feat/cs-m1-apps-and-prisma
npm install
npm run typecheck
```

- [ ] Next app `apps/web` altında çalışıyor; `npm run dev` /admin açılıyor
- [x] Worker `apps/worker` altında çalışıyor; scheduler tick smoke OK
- [x] Prisma client + schema `packages/db` üzerinden import ediliyor
- [x] Root scripts (`worker`, `typecheck`, `build`) yeni path’lerle yeşil
- [x] README + `docs/MONOREPO.md` yeni layout ile güncel
