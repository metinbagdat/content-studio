## Meta
- **ID:** CS-09
- **Status:** doing
- **Repo:** content-studio

## Summary
FFmpeg pipeline for long-form YouTube + short-form TikTok/Reels/Shorts.

## Scope
- [x] Voiceover + visuals + background music merge (local `ffmpeg-static` / `ffprobe-static`)
- [x] Platform exports: 16:9 + 9:16
- [x] Thumbnail generation hook
- [x] SRT wrap (2 satır) + 9:16 burn-in (büyük font, yüksek MarginV) + sidecar `.srt`
- [x] Ken Burns sosyal klipte caption burn-in
- [ ] TikTok/Reels real upload (OAuth / App Review)

## Verified (local)
- 2026-08-15: 4 YouTube videos published
- Smoke: `npx tsx scripts/verify-youtube-ffmpeg.ts`
