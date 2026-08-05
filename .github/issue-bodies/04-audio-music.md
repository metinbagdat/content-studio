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
- [x] FFmpeg assembly: intro music → narration → outro (`lib/media/generatePodcast.ts`)
- [x] March/song spoken audio over local music bed (`lib/media/generateSong.ts` + `storage/music-library/`)
- [ ] Suno or Udio API for real sung composition (deferred — lyrics + TTS+bed interim)

## Current state
- Lyrics generation via Groq — **done**
- Podcast MP3 generation (edge-tts/OpenAI) — **done**, triggered from `/admin/review` or `/admin/media`,
  or automatically on bulk-approve with `autoMedia`
- Song/march: TTS + optional local music bed — **done** (not Suno/Udio sung audio)

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 step 9, Phase 3 step 10
