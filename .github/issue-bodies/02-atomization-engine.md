## Summary
Generate ~50 content pieces from one article using the atomization plan (Groq/GPT planning).

## Scope
- [ ] `generateAtomizationPlan()` — **scaffold done** (`lib/atomization/plan.ts`)
- [ ] Generate Twitter threads, LinkedIn carousels, short video scripts from plan counts
- [ ] Platform-specific captions via `lib/platforms/formats.ts`
- [ ] Store each piece as `DerivedContent` with series metadata
- [ ] Extend `ContentType` enum (THREAD, CAROUSEL, SHORT_VIDEO, etc.)

## Depends on
Atomization plan attached to pipeline config after Phase 1 analysis.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 1 step 5, Phase 2
