## Meta
- **ID:** CS-SM-01b
- **Status:** doing → closing in PR
- **Parent:** CS-SM-01 / [#33](https://github.com/metinbagdat/content-studio/issues/33)
- **Repo:** content-studio
- **GitHub:** [#56](https://github.com/metinbagdat/content-studio/issues/56)

## Summary

`/admin/social` segment UX: rozet + `metadata.segment` → kaynak `seg:` tag fallback + filtrenin **taslak ve yayın** listelerine uygulanması + **PublishedPostsPanel** etiketleri.

## Scope

- [x] `GET /api/social`: `segment` = derived `metadata.segment` **veya** `source.tags` → `parseSegmentFromTags`
- [x] Segment dropdown: yayın **ve** taslak listelerini daraltır
- [x] Post kartında segment badge (`SEGMENT_LABELS`)
- [x] Aktif filtre chip’i (`Filtre: TYT` …)
- [x] `PublishedPostsPanel`: `SEGMENT_LABELS` (not `.toUpperCase()`), null → «Segment yok» + `.published-post-chip.muted` style
- [ ] Merge sonrası smoke: TYT draft rozet + filtre; eski `seg:` tag post fallback

## Files

- `apps/web/app/api/social/route.ts`
- `apps/web/app/admin/social/page.tsx`
- `apps/web/components/admin/PublishedPostsPanel.tsx`
- `apps/web/app/globals.css` (`.published-post-chip.muted`)

## Done when

- Sosyal’da segment seçince taslak sayısı da düşer
- Yayın listesinde `veli` → **Veli**, `egitimci` → **Eğitimci**
- Segment yoksa görünür «Segment yok» (sessiz boş değil)
