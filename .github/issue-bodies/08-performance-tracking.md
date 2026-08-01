## Meta
- **ID:** CS-08
- **Status:** doing
- **Repo:** content-studio

## Summary
Fetch engagement metrics per post and feed back into posting time / content optimization.

## Scope
- [x] Platform analytics APIs (LinkedIn org/member share stats, X user + tweet public_metrics) — `lib/social/platformStats.ts`
- [x] Store in `SocialMediaPost.metrics` JSON (`analytics` field) + `SocialMediaAccount.config.stats`
- [x] Dashboard: per-platform stats cards + per-post analytics badges (`/admin/social`)
- [x] `SYNC_ANALYTICS` periodic job — `lib/social/analyticsCron.ts`, started from `workers/index.ts`
      (default every 3h, `ANALYTICS_SYNC_ENABLED`/`ANALYTICS_SYNC_INTERVAL_MINUTES` env, worker
      process only — `npm run worker` must be running; the Next.js dev/admin process does not
      run background timers)
- [x] Dashboard: top performers ranking (`TopPerformersPanel`, sorted by stored engagement)
- [ ] Adjust `pickPostingSlot()` based on historical data — deferred until enough published
      posts with metrics accumulate to make a real (non-noisy) time-of-day signal

## Note
X API metrics (followers, tweet impressions) require a paid tier (Basic ~$200/mo) —
free tier returns HTTP 402, surfaced as a clear message in the UI rather than failing silently.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 7 step 18
