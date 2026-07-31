## Meta
- **ID:** CS-04
- **Status:** todo
- **Repo:** content-studio

## Summary
Full audio pipeline: TTS narration, Suno/Udio song composition, march/anthem, podcast intro/outro music.

## Scope
- [ ] ElevenLabs / PlayHT TTS for podcast + video voiceover
- [ ] Suno or Udio API for song + march from lyrics (`MARCH_LYRICS`, `SONG_LYRICS`)
- [ ] Background music library (mood tags)
- [ ] FFmpeg assembly: intro music → narration → outro (`lib/media/generatePodcast.ts` extension)

## Current state
- Lyrics generation via Groq — **done**
- edge-tts stub in `lib/media/tts.ts`

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 step 9, Phase 3 step 10
