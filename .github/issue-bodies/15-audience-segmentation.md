## Meta
- **ID:** CS-SM-01
- **Status:** doing
- **Parent:** CS-SM-EPIC
- **Repo:** content-studio
- **GitHub:** #33

## Summary

TYT / AYT / LGS / veli / eğitimci segmentleri için içerik etiketleme ve dağıtım kuralları.

## Scope

- [x] Segment taxonomy: `tyt`, `ayt`, `lgs`, `veli`, `egitimci`, `genel` (`lib/audience/segments.ts`)
- [x] Discovery / atomization / source create → `seg:{id}` tag + `metadata.segment`
- [x] Caption hashtag varyantları segmente göre
- [x] Platform routing: segment → platform öncelik sırası (pipeline default)
- [x] Admin UI: segment filtresi (Onay + Sosyal yayın listesi)
- [ ] LLM-based assignment (rules first; LLM later if needed)

## Done when

- [x] En az 3 segment etiketli draft üretilebiliyor
- [x] Yayın listesinde segmente göre filtre
- [x] Bir pipeline koşusunda segment metadata DB’de saklanıyor
