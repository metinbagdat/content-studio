## Meta
- **ID:** CS-01
- **Status:** todo
- **Repo:** content-studio

## Summary
Generate ~50 content pieces from one article using the atomization plan (Groq/GPT planning).

## Start when
- Pipeline stores atomization plan in config

## Done when
- One article yields ~50 `DerivedContent` rows matching plan counts; reviewable in `/admin/review`

## Scope
- [ ] `generateAtomizationPlan()` — scaffold done (`lib/atomization/plan.ts`)
- [ ] Generate Twitter threads, LinkedIn carousels, short video scripts from plan counts
- [ ] Platform-specific captions via `lib/platforms/formats.ts`
- [ ] Store each piece as `DerivedContent` with series metadata
- [ ] Extend `ContentType` enum as needed (THREAD, CAROUSEL, SHORT_VIDEO, …)

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 1–2 · related: CS-02

