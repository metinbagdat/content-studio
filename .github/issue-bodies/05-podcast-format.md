## Meta
- **ID:** CS-05
- **Status:** done
- **Repo:** content-studio
- **GitHub:** #10

## Summary
Upgrade podcast scripts to multi-segment structure with intro/outro music cues.

## Scope
- [x] LLM prompt: intro music cue → welcome → segments[] → keyTakeaways[] → CTA → outro music cue
- [x] JSON schema validation (zod)
- [x] TTS narration skips music-cue text
- [x] Admin preview of segment timeline — `PodcastTimeline` (+ per-block duration estimate)
- [x] Multiple episodes from long articles (`suggestedPodcastEpisodeCount` + pipeline loop; max 3)
- [x] Selftests: `podcastSchema.selftest.ts`, `podcastEpisodes.selftest.ts`

## Current state
Long sources (≥4500 chars → 2, ≥9000 → 3) produce `Podcast 1/n` scripts with `seriesId` / episode metadata. TTS/jingle path: intro → parts → mid jingles → outro.
