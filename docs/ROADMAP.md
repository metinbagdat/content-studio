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
| CS-M2 | Shared packages (`packages/core`) | todo | CS-M1 merged | Post-Prisma shared-core extraction only (`packages/core`) |
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
| CS-11 | Infographic text format | doing | CS-01 | Bullet/stat copy generated + reviewable; image rendering waits on CS-03/CS-10 |
| CS-SM-01 | Audience segments (TYT/AYT/LGS/veli) | doing | CS-SM-EPIC | Tags + caption hashtags + platform order + Onay/Sosyal filter (`lib/audience/segments.ts`) |
| CS-WP | WordPress SEO hub bridge | doing | wp-seo-hub repo | TT4 homepage + Rank Math installed; **next:** Rank Math wizard + GSC + Samurai-publish first drafts (no Soro autopilot) |
| CS-EM-01 | Hostinger Reach contact API | doing | Reach token **after** first real posts | `lib/email/hostingerReach.ts` + `POST /api/email/reach`; live sync needs `HOSTINGER_API_TOKEN` |
| CS-EM-02 | Admin e-posta sayfası | doing | CS-EM-01 | `/admin/email` kişi ekle / liste |
| CS-EM-03 | WP yayın → bülten hatırlatması | todo | First posts live + CS-EM-01 | Kampanya send API yok; Onay/WP sonrası Reach’te manuel gönder hatırlatması |

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
| 2 | Technical SEO | Rank Math **plugin active**; **you:** Rank Math setup wizard + GSC property. Sitemap until wizard: `https://blog.egitim.today/wp-sitemap.xml` |
| 3 | First real articles | Draft ready: WP post **#15** (Samurai approve → publish). Need 3–5 total |
| 4 | Every post CTA → `egitim.today` | Homepage CTA live; keep on every article |
| 5 | Topic engine (HPV) | **code:** DataForSEO + optional GSC; live when credentials are set. Fallback list remains. |
| 6 | Product-site clusters + OG | LearnCon **LC-G6** (pulled forward) |
| 7 | Publish webhook → SM | Code ready; live smoke after first human publish |
| 8 | Reach newsletter | After posts exist |

**Defer:** CS-M2, CS-03 DALL-E art, CS-04 Suno, CS-06 Meta/TikTok App Review, Pinterest.

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
