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

## Next Tasks
1. Confirm eğitim.today RSS URL; add RSS fetcher cron + manual URL already done.
2. Move analyze/generate to background tasks (APScheduler/Celery) to avoid request blocking.
3. Gather social OAuth keys (Twitter/X, LinkedIn) to begin publishing phase.
