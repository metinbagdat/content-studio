## Summary
Turn atomization plan into scheduled `SocialMediaPost` rows spread over 14 days.

## Scope
- [ ] `buildDistributionCalendar()` — **scaffold done** (`lib/scheduling/distributionCalendar.ts`)
- [ ] IST optimal times — **scaffold done** (`lib/scheduling/postingTimes.ts`)
- [ ] Admin UI: calendar preview + bulk schedule
- [ ] Respect daily limits per platform
- [ ] Worker: `drainDuePosts` already polls scheduled posts

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 5 steps 14–15
