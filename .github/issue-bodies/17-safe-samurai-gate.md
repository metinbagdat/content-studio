## Meta
- **ID:** CS-WP-02
- **Repo:** content-studio
- **Sprint:** 2–3

## Summary
Gönderim öncesi Safe samurAI: OpenAI Moderation + HKMT/dil kuralları; reddedilirse WP’ye gitmez.

## Scope
- [ ] `lib/wordpress/safeSamurai.ts`
- [ ] Moderation API + gpt-4o-mini HKMT check
- [ ] Fail-closed on LLM errors (manuel inceleme)
- [ ] Log + admin görünür red sebebi
