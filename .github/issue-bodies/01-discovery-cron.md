## Summary
Wire Phase 0 discovery into the worker as a daily cron (06:00 Europe/Istanbul).

## Scope
- [ ] `workers/index.ts` — schedule `runContentDiscovery()` daily
- [ ] Sitemap scan (`lib/discovery/sitemap.ts`) — **scaffold done**
- [ ] Duplicate detection by slug/title — **scaffold done**
- [ ] Ingest + auto-trigger pipeline — **scaffold done**
- [ ] RSS fallback when `/rss` becomes available
- [ ] Admin log / notification on new articles

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 0

## CLI (manual today)
```bash
npm run discovery:scan
```
