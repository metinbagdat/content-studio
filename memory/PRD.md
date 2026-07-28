# content-studio — PRD

## Original Problem Statement
eğitim.today İçerik Atomizasyon & Otomatik Yayın Platformu. Bir makaleyi LLM + görsel + ses + müzik + video pipeline'ından geçirerek 50+ içerik parçasına dönüştüren; admin onay kuyruğu + otomatik zamanlama ile sosyal kanallara dağıtan web uygulaması.

## Agreed MVP Scope (Phase odağı: Analiz + Atomizasyon + İçerik Üretimi)
- Model choices: Text=Gemini (gemini-3.5-flash), Image=Gemini Nano Banana (gemini-3.1-flash-image-preview), Audio=OpenAI TTS (tts-1). Auth=JWT email/password. Publishing/social = deferred.

## Architecture
- Backend: FastAPI + MongoDB (Motor). Files: server.py (routes), auth.py (JWT/bcrypt/seed), ai_service.py (Gemini text/image + OpenAI TTS via emergentintegrations + EMERGENT_LLM_KEY), blueprint.py (50-atom blueprint + prompt builders).
- Frontend: React + Tailwind + shadcn/ui. Dark Linear/Notion theme (Cabinet Grotesk / Manrope / JetBrains Mono). AuthContext + Bearer token in localStorage (cs_token).
- Collections: users, articles, atoms, quotas, jobs.

## User Personas
- Admin/İçerik Editörü (eğitim.today ekibi): makale ekler, atomize eder, üretir, onaylar.

## Implemented (2026-07-26)
- JWT admin auth (seed admin@egitim.today/admin123), login/me.
- Article input: manual paste + URL fetch (HTML strip) + SHA256 duplicate check.
- Gemini article analysis (summary/concepts/quotes/audience/tone/key_points).
- Atomization blueprint engine: 50 atoms across YouTube/TikTok/podcast/song/anthem/cards/Twitter/LinkedIn/Instagram/Facebook/Pinterest/thumbnail.
- AI generation per atom: text (Gemini), image (Nano Banana), audio (Gemini lyrics/script + OpenAI TTS). Hybrid approval: short text posts auto-approve, media/long content -> review.
- Kanban Review Queue: approve/reject/edit/regenerate + bulk approve.
- Dashboard stats + quota tracking; Observability (job logs + daily quota).
- Verified: 20/20 backend tests pass; full UI flow passes.

## Publishing Phase (2026-07-27)
- Twitter/X publishing integrated REAL (publisher.py): POST /2/tweets via OAuth2 user Bearer token (@egitimtoday). Single tweet + thread (reply-chain) support. Tokens stored in social_tokens collection (seeded from env, updatable via POST /api/social/twitter/token).
- Endpoints: GET /api/social/status, POST /api/atoms/{id}/publish. AtomCard has "Yayınla" button for approved Twitter/X atoms; Observability shows connection status per platform.
- BLOCKER (X-side, not code): POST returns 402 "credits depleted" — the X developer account's write quota/plan is exhausted; error surfaced clearly to admin. Read (verify) works. Will function once X account has write credits.
- LinkedIn: NOT connected — user provided placeholder Client ID/Secret (`...`). Playbook ready (LinkedIn OAuth + /rest/posts); pending real keys.
- Token durability note: provided X token is OAuth2 (~2h expiry) + refresh token; refresh needs OAuth2 Client ID/Secret (not yet provided) OR paste a fresh token via the token endpoint.

## LinkedIn Publishing (2026-07-27)
- Real Client ID/Secret provided. Full OAuth2 (OpenID Connect) connect flow: GET /api/linkedin/login (returns auth URL, scopes: openid profile email w_member_social), GET /api/linkedin/callback (exchanges code, fetches /v2/userinfo for member sub, stores token in social_tokens, redirects to /observability?linkedin=connected).
- Publishing: publisher.publish_linkedin -> POST /rest/posts (LinkedIn-Version 202607, X-Restli 2.0.0) as urn:li:person:{sub}, commentary with reserved-char escaping, 2900 char cap.
- UI: Observability "Bağlan" button (data-testid linkedin-connect-btn) + connected state; AtomCard "Yayınla" now covers LinkedIn atoms too.
- STATUS: Code-complete & wired. NOT yet end-to-end verified because it requires the admin's one-time LinkedIn consent (browser OAuth) which only the user can perform. Redirect URI registered must exactly equal LINKEDIN_REDIRECT_URI.
- Twitter/X: retried with new API keys — still 402 credits depleted (X account write plan/quota, not code). Provided access token is still OAuth2 (not OAuth1a).

## Prioritized Backlog
- P0: eğitim.today RSS/API cron ingestion (06:00 IST); background job queue for analyze/generate (currently blocking); "generate all" bulk pipeline.
- P1: Scheduling calendar (drag-drop) + publisher worker; real social integrations (Twitter/X, LinkedIn first) — needs OAuth developer apps/keys from user.
- P1: Blueprint template editor UI; platform-specific formatting rules/preview polish.
- P2: FFmpeg video assembly; Suno music; Edge-TTS Turkish voices; analytics/feedback loop; performance metrics.

## UI Redesign + Publish Verified (2026-07-27)
- LinkedIn publishing VERIFIED end-to-end (real post): https://www.linkedin.com/feed/update/urn:li:share:7487459635961126912 . Connected as 'metin bağdat'.
- Root cause of 'publish button not visible': LinkedIn atoms were in 'draft'; publish button shows only for approved social atoms. Generating them (auto_approve → approved) reveals the button.
- Redesigned Dashboard (accent stat cards incl. Yayınlanan, Bağlı Hesaplar, Son Makaleler, Kota), ReviewQueue (4-column responsive grid + article/platform filters), AtomCard (full-width 'İçerik Üret' for drafts, prominent branded 'Yayınla' CTA). Added ArticleDetail client-side bulk 'Eksik N Atomu Üret' with progress.
- dashboard/stats now returns 'published' count (verified = 1 after real post).
- Twitter/X: still 402 credits depleted — X account is on 'Pay Per Use' project with 0 credits; user must add credits or switch to Free tier (Billing → Credits / Products).
- Verified by testing_agent iteration_3: 100% backend, 100% frontend.

## Scheduling & Auto-Publish (2026-07-27)
- Calendar-based scheduled publishing. Atoms gain scheduled_at/publish_attempts/last_error/dead fields.
- Endpoints: POST /atoms/{id}/schedule, POST /atoms/{id}/unschedule, POST /schedule/auto (distributes to optimal IST slots ~09:00/12:30/18:00/21:00), GET /schedule (unscheduled + timeline).
- APScheduler worker every 1 min: publishes due atoms; on failure auto-retry, dead-letter after 3 attempts. Shared _do_publish() used by manual + scheduled publish (incl. Twitter OAuth2 refresh).
- New 'Takvim' page (/schedule): unscheduled list with datetime picker + 'Zamanla', 'Otomatik Dağıt', timeline grouped by day with Yayınlandı/Zamanlandı/Başarısız(DLQ) badges + Şimdi Yayınla/Tekrar/Kaldır actions. AtomCard shows amber 'zamanlandı' indicator.
- Verified testing_agent iteration_4: 100% backend + frontend; worker executed past-scheduled Twitter atom → 402 retry/DLQ confirmed.

## Analytics + Drag-Drop Calendar (2026-07-27)
- Takvim: native HTML5 drag-drop reschedule across a 14-day drop grid (day-0..13); dropping a card reschedules keeping time-of-day. Published list + DLQ actions retained.
- New Analitik page (/analytics) + GET /api/analytics: published by platform/type/IST-hour, scheduled/failed totals, DLQ list w/ retry, blueprint feedback suggestions (data-derived; engagement metrics noted as requiring paid social read APIs — not fabricated).
- Verified testing_agent iteration_5: 100% backend + frontend; drag_to reschedule confirmed.
- NOTE: Emergent Universal Key budget exhausted ($1.02/$1.00) → content generation (Gemini/OpenAI) now 500s until balance added.

## Free Providers (2026-07-27)
- Emergent Universal Key budget exhausted ($1). Added free fallbacks:
  - TEXT: Groq (llama-3.3-70b-versatile) via GROQ_API_KEY — used as primary when key present. VERIFIED (Twitter atom auto-approved, LinkedIn generated).
  - AUDIO: Edge-TTS (tr-TR-Emel/Ahmet, no key). VERIFIED (song lyrics via Groq + 626KB mp3).
  - IMAGE: HF Inference attempted (router.huggingface.co) but hf-inference provider deprecated SDXL/FLUX (410) and account non-Pro/no-credit → free image gen NOT available. generate_image raises a clean Turkish message; bulk-generate skips and continues.
- ai_service.py: generate_text prefers Groq, generate_image uses HF (clean error), generate_audio uses Edge-TTS. Keys in backend/.env (GROQ_API_KEY, HF_TOKEN).
- WYSIWYG publish preview: AtomPreview.jsx dialog (Twitter/LinkedIn/generic faithful cards) + 'Önizle' button on every AtomCard.

## Free Image via Pollinations (2026-07-27)
- IMAGE now works FREE keyless via https://image.pollinations.ai/prompt/{prompt} (verified 84KB image). Optional POLLINATIONS_API_KEY (from enter.pollinations.ai) upgrades to gen.pollinations.ai Nano Banana (nanobanana-2-lite/2/pro).
- ALL THREE modalities free (no Emergent budget): TEXT=Groq, AUDIO=Edge-TTS, IMAGE=Pollinations.

## Next Tasks
1. Confirm eğitim.today RSS URL; add RSS fetcher cron + manual URL already done.
2. Move analyze/generate to background tasks (APScheduler/Celery) to avoid request blocking.
3. Gather social OAuth keys (Twitter/X, LinkedIn) to begin publishing phase.

## Iteration 6 — Pollinations Key, Bulk Approve, Watermark, Auto-Schedule (2026-06 / handoff date 2026-07-28)
User choices: nanobanana-2 model; text watermark 'eğitim.today' bottom-left; two-version (watermarked vs original) selectable; platform-based optimal-time auto-scheduling; deploy deferred (wants detailed guidance later); balance added later.
- IMAGE (ai_service._pollinations_image): POLLINATIONS_API_KEY + POLLINATIONS_MODEL=nanobanana-2 in backend/.env. Tries paid gen.pollinations.ai/image/{p}?model=nanobanana-2 (Bearer); on 402/403 (no balance) AUTO-FALLS BACK to free keyless image.pollinations.ai. NOTE: account balance currently 0 → all authenticated models 402 → free endpoint used; images still produced. Add pollen at enter.pollinations.ai to activate nanobanana-2.
- WATERMARK (ai_service.apply_watermark via Pillow, FreeSansBold): semi-transparent white 'eğitim.today' + indigo (#5E6AD2) dot bottom-left; aspect_size(): social_card 1024x1024 (1:1), thumbnail 1280x720 (16:9), else 1024x1024.
- Image atoms now store media_original + media_watermarked + media(=selected, default watermarked) + media_choice. Endpoints: GET /atoms/{id}/media (with read-time backfill for legacy atoms), POST /atoms/{id}/select-media {choice}. List projections exclude the big media_* fields.
- Frontend AtomPreview.jsx: image atoms show ImageVersionSelector (Watermark'lı vs Orijinal side-by-side, 'Seçili' badge, persists on click). Text atoms keep WYSIWYG preview.
- BULK APPROVE: POST /atoms/bulk-approve {ids} → {ok,count,scheduled}; ReviewQueue checkboxes (İnceleme+Onaylı columns) + 'N Atomu Onayla' button.
- AUTO-SCHEDULE: approving/generating(auto_approve) a Twitter/X or LinkedIn atom with content auto-assigns next free platform-optimal slot. Slots (TR local, UTC = -3): LinkedIn 08:00/12:00/17:30; Twitter/X 09:00/12:30/15:00/20:00. _auto_schedule_atom idempotent + collision-avoiding. /schedule/auto handles leftovers. Schedule.jsx subtitle updated.
- Verified testing_agent iteration_6: backend 10/10, frontend 100%. No functional issues.

## Backlog / Future
- P1: Detailed deployment guidance for full-stack (FastAPI+Mongo+APScheduler) — Vercel frontend-only; recommend Emergent Deploy / Railway / Render for backend+worker+persistent DB.
- P2: Real post-publish metrics (views/likes) feedback loop; optimum-time recommendations by timezone.
- P2: Blueprint template editor UI.
