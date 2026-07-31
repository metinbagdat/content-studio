## Meta
- **ID:** CS-00
- **Status:** done (RSS fallback still open)
- **Repo:** content-studio

## Summary
Wire Phase 0 discovery into the worker as a daily cron (06:00 Europe/Istanbul).

## Start when
- Sitemap client exists

## Done when
- Worker schedules daily run; admin can trigger manually; duplicates skipped

## Scope
- [x] `workers/index.ts` — `startDiscoveryCron()` daily 06:00 IST
- [x] Sitemap scan (`lib/discovery/sitemap.ts`)
- [x] Duplicate detection by slug/title
- [x] Ingest + auto-trigger pipeline
- [ ] RSS fallback when `/rss` becomes available
- [x] Admin UI `/admin/discovery` + `/api/discovery`

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 0 · `npm run discovery:scan`

