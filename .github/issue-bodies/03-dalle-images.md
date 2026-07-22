## Summary
DALL-E 3 / Stable Diffusion integration for social cards, thumbnails, carousel slides, Pinterest pins.

## Scope
- [ ] API client + env config (`OPENAI_API_KEY` / Replicate)
- [ ] Brand-consistent prompts (palette from `postImageDesign.ts`)
- [ ] Generate per `lib/image/platformSizes.ts` dimensions
- [ ] 2–3 variations per prompt for A/B
- [ ] Store in `MediaFile` with platform metadata

## Current state
OG PNG cards via `next/og` in `generatePostImage.ts` (1200×630 only).

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 step 8
