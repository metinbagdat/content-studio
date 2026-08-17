## Meta
- **ID:** CS-08
- **Status:** doing
- **Repo:** content-studio
- **GitHub:** #5

## Summary
Fetch engagement metrics per post and feed back into posting time / content optimization.

## Scope
- [x] Platform analytics APIs (LinkedIn org/member share stats, X user + tweet public_metrics) — `lib/social/platformStats.ts`
- [x] Store in `SocialMediaPost.metrics` JSON (`analytics` field) + `SocialMediaAccount.config.stats`
- [x] Dashboard: per-platform stats cards + per-post analytics badges (`/admin/social`)
- [x] `SYNC_ANALYTICS` periodic job — `lib/social/analyticsCron.ts`
- [x] Dashboard: top performers ranking (`TopPerformersPanel`)
- [x] Admin **Yorumlar** read-only digest + Onay bandı
- [x] `pickPostingSlot()` via `getAdaptiveSlotOrder()` — ≥5 samples; Takvim’de adaptive rapor
- [x] Facebook post reactions/comments/shares into `metrics.analytics` (insights impressions still App Review)
- [~] More published samples so adaptive actually reorders weekday slots

## Note
X API metrics require a paid tier (Basic ~$200/mo) — free tier HTTP 402.
