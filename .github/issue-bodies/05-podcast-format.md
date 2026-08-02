## Meta
- **ID:** CS-05
- **Status:** doing
- **Repo:** content-studio

## Summary
Upgrade podcast scripts to multi-segment structure with intro/outro music cues.

## Scope
- [x] LLM prompt: intro music cue → welcome → segments[] → keyTakeaways[] → CTA → outro music cue
      (`lib/ai/transform.ts` PODCAST_SCRIPT prompt)
- [x] JSON schema validation (zod) — `lib/media/podcastSchema.ts`, with automatic upgrade of the
      old `{intro, segments, outro}` shape and a safe fallback when the LLM output doesn't parse
- [x] TTS narration (`extractPodcastSpeech`) speaks welcome/segments/takeaways/CTA and explicitly
      skips music-cue text (those are editing notes, not spoken lines)
- [x] Admin preview of segment timeline — `/admin/review` renders `PodcastTimeline` (per-segment
      cards) instead of a raw JSON dump for `PODCAST_SCRIPT` items
- [ ] Multiple episodes from long articles — still one `PODCAST_SCRIPT` per pipeline run
      (`plan.contentPieces.podcastEpisodes` isn't wired to multi-episode generation yet)

## Current state
Structured, validated podcast script feeding real TTS audio (`generatePodcastAudio`).
Intro/outro **music** itself is still a text cue for a human editor to add — no music-bed
mixing (`lib/media/generatePodcast.ts` only synthesizes the spoken narration).

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 §7.2
