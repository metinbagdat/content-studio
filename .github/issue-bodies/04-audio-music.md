## Meta
- **ID:** CS-04
- **Status:** doing
- **Repo:** content-studio

## Summary
Full audio pipeline: TTS narration, Suno/Udio song composition, march/anthem, podcast intro/outro music.

## Scope
- [x] Working TTS for podcast narration — edge-tts (free, default) or OpenAI TTS (`lib/media/tts.ts`, `generatePodcastAudio()`)
- [ ] ElevenLabs / PlayHT as higher-quality TTS alternative
- [ ] Suno or Udio API for song + march **audio** from lyrics (`MARCH_LYRICS`, `SONG_LYRICS` are text-only today)
- [ ] Background music library (mood tags)
- [ ] FFmpeg assembly: intro music → narration → outro (`lib/media/generatePodcast.ts` extension)

## Current state
- Lyrics generation via Groq — **done**
- Podcast MP3 generation (edge-tts/OpenAI) — **done**, triggered from `/admin/review` or `/admin/media`,
  or automatically on bulk-approve with `autoMedia`
- Song/march remain **lyrics text only** — no audio composition yet

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 step 9, Phase 3 step 10
