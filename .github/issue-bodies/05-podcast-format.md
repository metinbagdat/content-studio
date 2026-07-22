## Summary
Upgrade podcast scripts to multi-segment structure with intro/outro music cues.

## Scope
- [ ] LLM prompt: intro music (5s) → welcome → segments → takeaways → CTA → outro music
- [ ] JSON schema validation (zod)
- [ ] Multiple episodes from long articles
- [ ] Admin preview of segment timeline

## Current state
Basic `PODCAST_SCRIPT` JSON via `transform.ts`.

## Reference
`docs/PIPELINE_V2_ARCHITECTURE.md` — Phase 2 §7.2
