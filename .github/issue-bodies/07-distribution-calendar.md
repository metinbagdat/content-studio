## Summary
Turn atomization plan into scheduled `SocialMediaPost` rows spread over 14 days.

## Scope
- [x] `buildDistributionCalendar()` — **scaffold done** (`lib/scheduling/distributionCalendar.ts`)
- [x] IST optimal times — **scaffold done** (`lib/scheduling/postingTimes.ts`)
- [x] Admin UI: calendar preview + bulk schedule (`/admin/calendar` + `/api/scheduling`)
- [ ] Respect daily limits per platform
- [x] Worker: `drainDuePosts` already polls scheduled posts

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 5 steps 14–15
