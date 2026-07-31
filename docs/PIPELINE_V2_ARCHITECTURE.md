# Enhanced Content Pipeline v2.0

Canonical architecture reference for content-studio. Implementation is phased via issue bodies (`.github/issue-bodies/`) and tracked in [ROADMAP.md](./ROADMAP.md). Monorepo plan: [MONOREPO.md](./MONOREPO.md).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | Content Discovery (sitemap/RSS scan) | Wired — worker cron + `/admin/discovery` + `/api/discovery` |
| 1 | Analysis & Atomization Plan | Partial — `lib/atomization/` |
| 2 | AI Content Generation | Existing Faz1 + caption series |
| 3 | Media Production (image/audio/video) | Partial — OG cards + edge-tts |
| 4 | Platform Formatting | Partial — `lib/platforms/` |
| 5 | Scheduling & Distribution | Wired — apply/preview API + `/admin/calendar` |
| 6 | Approval Gate | Existing `/admin/review` |
| 7 | Publishing | Existing LinkedIn/X + replace-in-place |
| 8 | Performance Tracking | Planned |

## Key modules

```
lib/discovery/     — sitemap scan, duplicate detection, ingest
lib/atomization/   — LLM atomization plan (Groq/OpenAI)
lib/platforms/     — rate limits, char limits, format hints
lib/image/         — platformSizes (aspect ratios)
lib/scheduling/    — IST posting windows, 14-day calendar
lib/content/       — captionSeries (4-part social from article)
lib/blog/          — fetchEgitimToday (live HTML → markdown)
```

## Discovery sources (priority)

1. `https://www.egitim.today/sitemap.xml` (blog URLs)
2. RSS feed when available (`/rss` — currently 404)
3. Manual script / URL slug (`scripts/run-zaman-pipeline.ts`)

## Atomization target (1 article → ~50 pieces)

See issue tracker for full breakdown: long-form video, podcast, song, march, social cards, threads, carousels, per-platform posts.

## Safety

- `autoPublish` hard-disabled in pipeline config
- Human approval required before social drafts
- Dry-run accounts excluded from draft creation
