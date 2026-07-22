## Summary
OAuth + API publishers for Instagram, TikTok, YouTube, Facebook, Pinterest.

## Scope
- [ ] OAuth flows per platform (extend `lib/social/oauth.ts`)
- [ ] Rate limit guard using `lib/platforms/limits.ts`
- [ ] Media upload (image/video) per platform requirements
- [ ] Carousel / thread / reel publish adapters

## Current state
LinkedIn + Twitter/X publish with replace-in-place — **done**

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 7, Platform Publishing Service
