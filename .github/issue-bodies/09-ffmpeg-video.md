## Meta
- **ID:** CS-09
- **Status:** doing
- **Repo:** content-studio

## Summary
FFmpeg pipeline for long-form YouTube + short-form TikTok/Reels/Shorts.

## Scope
- [x] Voiceover + visuals + background music merge (local `ffmpeg-static` / `ffprobe-static` via `lib/media/ffmpegPaths.ts`)
- [x] Platform exports: 16:9 + 9:16 (YouTube long + Shorts published locally)
- [x] Thumbnail generation hook (YouTube thumbnail upload best-effort)
- [ ] SRT subtitles + burned-in captions polish for vertical video
- [ ] TikTok/Reels real upload (OAuth / App Review)

## Verified (local)
- 2026-08-15: 4 YouTube videos published (`WD4ub9BDRvE`, `U2kZ1hdN2Vs`, `MeG0-e_OKu4`, `UPTo8GRDDro`)
- Smoke: `npx tsx scripts/verify-youtube-ffmpeg.ts`

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 3 step 11
