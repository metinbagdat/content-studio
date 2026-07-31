## Meta
- **ID:** CS-06
- **Status:** todo
- **Repo:** content-studio

## Summary
OAuth + API publishers for Instagram, TikTok, YouTube, Facebook, Pinterest (egitim.today promotion).

## Start when
- Developer apps / keys available per platform; CS-02 captions exist

## Done when
- Each platform can publish an approved draft (or clear dry-run) with rate limits respected

## Scope
- [ ] OAuth flows per platform (extend `lib/social/oauth.ts`)
- [ ] Rate limit guard using `lib/platforms/limits.ts`
- [ ] Media upload (image/video) per platform requirements
- [ ] Carousel / thread / reel publish adapters

## Current state
LinkedIn + Twitter/X publish with replace-in-place — **done**

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 7

