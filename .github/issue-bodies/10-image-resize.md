## Meta
- **ID:** CS-10
- **Status:** doing
- **Repo:** content-studio

## Summary
Resize/crop generated images for each platform aspect ratio.

## Scope
- [x] Specs from `lib/image/platformSizes.ts` used directly — each card is now **rendered**
      at its target aspect ratio (`next/og` renders at any width/height natively), so no
      separate crop/resize pass is needed for the template-based cards (see CS-03)
- [ ] Sharp or FFmpeg pipeline for **uploaded/custom** images (a user-provided photo that
      needs cropping to multiple ratios) — still open, only auto-generated cards are covered
- [ ] Batch export: derive all platform sizes from one master photo (relevant once CS-03's
      AI-art variant exists — a template card can just be re-rendered per size for free,
      a photo can't)
- [ ] File size optimization (JPEG quality) — PNG only today

## Current state
Auto-generated cards render directly at the correct per-platform size (done via CS-03).
Resize/crop of externally supplied images is not implemented.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 3 step 12, issue #8 table row
