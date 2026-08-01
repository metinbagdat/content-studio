## Meta
- **ID:** CS-11
- **Status:** doing
- **Repo:** content-studio

## Summary
Infographic content format from the "Blog → Çoklu Format → SM Yayını" process design —
structured, design-ready bullet copy (headline + stat points) for a graphic designer or
AI image tool to turn into a visual infographic.

## Scope
- [x] `ContentType.INFOGRAPHIC_TEXT` enum value
- [x] `generateInfographicText()` — headline/subhead/points(label+stat+detail) via LLM,
      fallback to article sections when LLM unavailable (`lib/atomization/generateDerivatives.ts`)
- [x] Wired into `generateAllDerivatives()` — generates regardless of selected SM platforms
      (design input, not tied to one channel)
- [x] `plan.contentPieces.infographicSlides` (default 2) in atomization plan
- [x] Reviewable in `/admin/review` (added to `CONTENT_TYPES` filter)
- [ ] Actual infographic **image** rendering (Canva/DALL-E template) — tracked in **CS-03**
- [ ] Per-platform image sizing (1080×1080 IG, etc.) — tracked in **CS-10**

## Done when
- One source article yields `infographicSlides` reviewable `INFOGRAPHIC_TEXT` rows with
  headline + numbered points ready to hand to a designer or image-generation step

## Reference
User-provided process doc: "Blog → Çoklu Format → SM Yayını Süreç Tasarımı" §2.B (İnfografik metni row)
