## Meta
- **ID:** CS-WP-02
- **Repo:** content-studio
- **Sprint:** 2–3
- **GitHub:** #35

## Summary
Gönderim öncesi Safe samurAI: OpenAI Moderation + HKMT/dil kuralları; reddedilirse WP’ye gitmez.

## Scope
- [x] `lib/wordpress/safeSamurai.ts`
- [x] Moderation API + LLM HKMT check (`SAFE_SAMURAI_ENABLED=false` ile skip)
- [x] Fail-closed on LLM errors (manuel inceleme)
- [x] Admin’de red sebebi (`validation.reason` mesajı)
- [ ] Live smoke with real OpenAI + WP host

## Depends
- CS-WP-01 publisher
