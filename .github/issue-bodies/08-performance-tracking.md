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
- [ ] `SYNC_ANALYTICS` queue job (currently manual "İstatistikleri yenile" button only, no cron)
- [ ] Dashboard: top performers ranking / engagement rate leaderboard
- [ ] Adjust `pickPostingSlot()` based on historical data (currently static IST windows only)

## Note
X API metrics (followers, tweet impressions) require a paid tier (Basic ~$200/mo) —
free tier returns HTTP 402, surfaced as a clear message in the UI rather than failing silently.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 7 step 18
