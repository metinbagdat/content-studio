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
- [x] Sharp pipeline for master photos — `lib/image/resizeBatch.ts` + `batchExportFromMaster.ts`
- [x] Batch export: LinkedIn, Twitter, IG, Pinterest, YT, TikTok sizes from one master
- [x] File size optimization (JPEG quality 85, mozjpeg)
- [x] Admin: `/admin/review` → "Tüm platform boyutları" · `/admin/media` export panel

## Current state
Auto-generated cards render directly at the correct per-platform size (done via CS-03).
Resize/crop of externally supplied images is not implemented.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 3 step 12, issue #8 table row
