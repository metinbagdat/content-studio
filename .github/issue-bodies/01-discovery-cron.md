## Summary
Wire Phase 0 discovery into the worker as a daily cron (06:00 Europe/Istanbul).

## Scope
- [x] `workers/index.ts` — `startDiscoveryCron()` daily 06:00 IST
- [x] Sitemap scan (`lib/discovery/sitemap.ts`) — **scaffold done**
- [x] Duplicate detection by slug/title — **scaffold done**
- [x] Ingest + auto-trigger pipeline — **scaffold done**
- [ ] RSS fallback when `/rss` becomes available
- [x] Admin UI `/admin/discovery` + `/api/discovery` (manual run + recent list)

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 0

## CLI (manual today)
```bash
npm run discovery:scan
```
