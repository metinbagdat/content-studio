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
| CS-M1 | Move Next app → `apps/web`, worker → `apps/worker` | todo | CS-M0 merged | Single workspace install; README paths updated; local smoke OK |
| CS-M2 | Shared packages (`packages/db`, `packages/core`) | todo | CS-M1 done | Prisma + shared lib imported via workspace packages |
| CS-00 | Discovery cron + admin UI | done | — | `/admin/discovery` + worker 06:00 IST |
| CS-01 | Atomization → ~50 derivatives | done | — | Counts match plan; THREAD/CAROUSEL/SHORT_VIDEO/INFOGRAPHIC stored |
| CS-02 | Platform captions (X, LI, IG, TT, YT, FB, Pin) | done | — | Formatters + limits per platform, reviewable with platform badge |
| CS-03 | Image generation (cards / thumbs) | doing | CS-02 | Cards now render at correct per-platform size/aspect ratio; DALL-E art variant still open (paid API) |
| CS-04 | Audio / music (TTS, march/song) | doing | CS-03 | Podcast jingles + march/song TTS+music bed done; Suno/Udio sung audio open |
| CS-05 | Podcast packaging | doing | CS-04 | Segments + zod + admin timeline + jingle assembly done; multi-episode open |
| CS-06 | Publishers: IG / TikTok / YT / FB / Pinterest | doing | OAuth apps ready | YouTube local publish verified (Shorts + long); X/LI local OK; Meta/TikTok App Review / prod OAuth still open; Pinterest API later |
| CS-07 | Distribution calendar apply | done | — | `/admin/calendar` preview + apply; weekday-preferred, weekend-reduced cadence |
| CS-08 | Performance feedback loop | doing | Metrics API access | X/LI stats + top-performers + admin **Yorumlar**; adaptive slots coded (`getAdaptiveSlotOrder`, min 5 samples); more published metrics still needed |
| CS-09 | FFmpeg short video | doing | Media storage ready | 9:16 Shorts + 16:9 path live locally (ffmpeg/ffprobe + YouTube upload); burn-in/subtitle polish still open |
| CS-10 | Image resize per platform | done | CS-03 | Batch JPEG export from master via sharp; template cards render direct per size |
| CS-11 | Infographic text format | doing | CS-01 | Bullet/stat copy generated + reviewable; image rendering waits on CS-03/CS-10 |
| CS-SM-01 | Audience segments (TYT/AYT/LGS/veli) | doing | CS-SM-EPIC | Tags + caption hashtags + platform order + Onay/Sosyal filter (`lib/audience/segments.ts`) |
| CS-WP | WordPress SEO hub bridge | doing | wp-seo-hub repo | CS-WP-01..04 code in repo (publisher, Safe samurAI, HPV gate, publish webhook); live WP smoke still blocked on Oracle A1 / host (`docs/WORDPRESS_BRIDGE.md`) |

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
| LC-G4 | Email/SMS/WhatsApp automations | learncon | 5 | SendGrid/Twilio flows |
| LC-G5 | Referral program | learncon | 6–7 | Invite link + reward/XP |
| LC-G6 | SEO topic clusters + OG cards | learncon | 6–7 | Pillar pages + rich previews |
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

## D. Near-term sequence (Content Studio)

1. Merge **CS-M0** (this change set).
2. Local: `git pull`, `npm install`, smoke `/admin`.
3. **CS-M1** PR: `apps/web` + `apps/worker` move.
4. Parallel product work: **CS-01** atomization depth + **CS-06** extra publishers when OAuth ready.
5. LearnCon growth: open LC-* issues inside learncon from section B.
