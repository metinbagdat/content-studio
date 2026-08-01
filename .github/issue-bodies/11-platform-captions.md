## Meta
- **ID:** CS-02
- **Status:** done
- **Repo:** content-studio

## Summary
Produce platform-specific captions/scripts for all target SM channels promoting egitim.today (not only X + LinkedIn).

## Start when
- Atomization plan counts exist on pipeline config (CS-01 scaffold OK)

## Scope
- [x] Captions: Instagram, TikTok, YouTube, Facebook, Pinterest (plus existing X/LinkedIn)
- [x] Enforce `lib/platforms/limits.ts` + `formats.ts`
- [x] Brand CTA via `brandCta()` on publishable text
- [x] Review queue shows platform badge per piece (`/admin/review` platform filter + badges)
- [x] Infographic copy format added (`INFOGRAPHIC_TEXT`, design-ready bullet text)

## Done when
- [x] One source article yields reviewable items for each configured platform kind
- [x] Auto-publish remains off; human approval required

## Note
Actual OAuth publish for new platforms is **CS-06** (dry-run infra ready, real OAuth still open).
