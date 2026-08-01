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
- [x] Rate limit guard using `lib/platforms/limits.ts` (daily cap + weekend-aware in calendar)
- [ ] Media upload (image/video) per platform requirements
- [ ] Carousel / thread / reel publish adapters

## Current state
- LinkedIn + Twitter/X publish with replace-in-place — **done**
- Dry-run account + draft-creation infrastructure now generic for **all** `SocialPlatform`
  values (YouTube/Instagram/TikTok/Facebook can be dry-run connected today from
  `/admin/social`, producing real `SocialMediaPost` DRAFT rows) — only the actual
  OAuth handshake + platform publish call remain per platform.
- `publishPost()` gives a clear "Faz 2" message (not a silent no-op) when a draft's
  platform has no publish adapter yet.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 7

