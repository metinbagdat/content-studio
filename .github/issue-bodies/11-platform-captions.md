## Meta
- **ID:** CS-02
- **Status:** todo
- **Repo:** content-studio

## Summary
Produce platform-specific captions/scripts for all target SM channels promoting egitim.today (not only X + LinkedIn).

## Start when
- Atomization plan counts exist on pipeline config (CS-01 scaffold OK)

## Scope
- [ ] Captions: Instagram, TikTok, YouTube, Facebook, Pinterest (plus existing X/LinkedIn)
- [ ] Enforce `lib/platforms/limits.ts` + `formats.ts`
- [ ] Brand CTA via `brandCta()` on publishable text
- [ ] Review queue shows platform badge per piece

## Done when
- [ ] One source article yields reviewable items for each configured platform kind
- [ ] Auto-publish remains off; human approval required

## Note
Actual OAuth publish for new platforms is **CS-06**. This issue is generation + storage only.
