## Meta
- **ID:** CS-07
- **Status:** done
- **Repo:** content-studio

## Summary
Turn atomization plan into scheduled `SocialMediaPost` rows spread over 14 days.

## Start when
- Pipeline config includes `distributionCalendar`

## Done when
- Admin can preview and apply schedule; worker drains due posts

## Scope
- [x] `buildDistributionCalendar()` (`lib/scheduling/distributionCalendar.ts`)
- [x] IST optimal times (`lib/scheduling/postingTimes.ts`)
- [x] Admin UI: calendar preview + bulk schedule (`/admin/calendar` + `/api/scheduling`)
- [x] Respect daily limits per platform (`maxPostsPerDay` check in placement loop)
- [x] Weekday-preferred placement + reduced weekend cadence/time windows ("hafta sonu daha az paylaşım")
- [x] Worker: `drainDuePosts` polls scheduled posts

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 5
