## Meta
- **ID:** CS-SM-01
- **Status:** done
- **Parent:** CS-SM-EPIC
- **Repo:** content-studio
- **GitHub:** #33

## Summary

TYT / AYT / LGS / veli / eğitimci segmentleri için içerik etiketleme ve dağıtım kuralları.

## Scope

- [x] Segment taxonomy: `tyt`, `ayt`, `lgs`, `veli`, `egitimci`, `genel` (`lib/audience/segments.ts`)
- [x] Discovery / atomization / source create → `seg:{id}` tag + `metadata.segment`
- [x] Caption hashtag varyantları segmente göre
- [x] Platform routing: segment → platform öncelik sırası (`platformsForSegment` → `createPipeline` → `normalizePlatforms` **preserves order** → `generateAllDerivatives` + `distributionCalendar`)
- [x] **Onay/Sosyal filter** (aşağıda tanım)
- [x] LLM assignment when rules return `genel` (`resolveAudienceSegment`) — tags → rules → LLM → fallback

## Onay / Sosyal filter — ne demek?

Aynı `AudienceSegment` değerleriyle admin listelerini **daraltmak**. Otomatik yayın seçimi değil; operatörün TYT’yi AYT’den ayırıp onaylaması / yayın kuyruğuna bakması için.

| Yüzey | Kontrol | Kaynak | Davranış |
|-------|---------|--------|----------|
| **Onay** (`/admin/review`) | Dropdown **Segment** | `GET /api/content?segment=` + istemci filtre | `metadata.segment` → yoksa kaynak `seg:` tag → yoksa başlıktan `detectAudienceSegment`. Kartta segment badge. |
| **Sosyal** (`/admin/social`) | Dropdown **Segment: …** | `GET /api/social` → `post.segment` | Aynı çözümleme (derived meta → source tags). **Taslak + yayın** listeleri filtrelenir. Kartta segment badge. Takip: [#56](https://github.com/metinbagdat/content-studio/issues/56) / `29-social-segment-badge-fallback.md` |

**Değildir:**
- Segmente göre otomatik publish / suppress
- GSC veya HPV ile bağlı filtre
- Platform dropdown’ının yerine geçen bir şey (Onay’da platform + segment **birlikte** AND)

## Segment resolve order (ingest)

`lib/audience/resolveAudienceSegment.ts`:

1. Explicit `seg:` tag
2. Rule keywords (`detectAudienceSegment`) if not `genel`
3. One LLM call (Groq/OpenAI) if rules are `genel`
4. Else `genel`

Hot paths (Onay/Sosyal list filter) stay sync rules/tags only — no LLM per row.

## Done when

- [x] En az 3 segment etiketli draft üretilebiliyor
- [x] Yayın listesinde segmente göre filtre
- [x] Bir pipeline koşusunda segment metadata DB’de saklanıyor
- [x] Platform sırası segmente göre gerçekten uygulanıyor
- [x] Belirsiz metinde LLM (key varsa) veya `genel` fallback
