## Meta
- **ID:** CS-03
- **Status:** doing
- **Repo:** content-studio

## Summary
Brand-consistent post images sized correctly per platform; DALL-E 3 / Stable Diffusion
photo-real variant is a later, optional upgrade once the template-based version is in use.

## Scope
- [x] Generate per `lib/image/platformSizes.ts` dimensions — `pickImageSpecKey(platform)`
      maps each `SOCIAL_CAPTION`'s target platform to its card size (X 1600×900, LinkedIn
      1200×627, Instagram 1080×1080 square, Facebook 1200×630, Pinterest 1000×1500 portrait)
      instead of always rendering 1200×630
- [x] Layout scales proportionally to the smaller image dimension so square/portrait formats
      keep sane font size and padding instead of inheriting landscape-only spacing
- [x] Store platform image metadata — `imageSpecKey`/`imageWidth`/`imageHeight` on
      `DerivedContent.metadata` (no schema change needed)
- [x] Brand-consistent design — palette from `postImageDesign.ts`, watermark from `CS-` brand pass
- [ ] API client + env config (`OPENAI_API_KEY` / Replicate) for a real DALL-E/SD art
      variant — deferred, costs money per image; current template renderer is free
      (`next/og`, no external API)
- [ ] 2–3 variations per prompt for A/B — needs the above image API first

## Current state
`next/og`-rendered branded cards, now sized per target platform. No photo-real AI art yet —
that's a separate, paid-API follow-up once there's a budget/appetite for it.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 step 8
