## Meta
- **ID:** CS-SM-EPIC
- **Status:** planning
- **Repo:** content-studio
- **Related:** #2 (publishers), #5 (analytics), #7 (calendar)

## Summary

Hedef kitle odaklı sosyal medya dağıtım otomasyonu (lise / üniversite adayları) — Content Studio merkezli.

> **Değerlendirme (2026-08-12):** Orijinal v2.0 taslağı pazarlama vizyonu olarak güçlü; uygulama için Content Studio gerçeklerine göre sadeleştirildi. Aşağıdaki “Out of scope / düzeltmeler”e bakın.

## Problem

`egitim.today` içerikleri (makale, video, podcast, şarkı) hedef kitleye sistematik ulaşmıyor.

**Hedef kitle:** TYT/LGS, AYT/YDT, 15–22 yaş, veliler/eğitimciler.

**Mevcut (repo gerçeği):**
- Pipeline + atomization + onay akışı var
- LinkedIn / Facebook / Instagram / YouTube / TikTok / X OAuth + publish (kısmi)
- Facebook `pages_manage_posts` token’a alındı (2026-08-12); App Review Advanced Access / Live App hâlâ açık
- Bulk publish Meta spam/rate-limit’e takılıyor (batch + gap eklendi)
- Segmentasyon / kişiselleştirilmiş dağıtım yok

## Amaçlar (mühendislik)

- [ ] Segment etiketleri (TYT, AYT, veli, …) içerik + draft üzerinde
- [ ] Segment → platform / caption / görsel şablonu kuralları
- [ ] Zamanlama + günlük limitler (mevcut calendar/limits ile)
- [ ] Meta App Review / Live + TikTok audit tamam
- [ ] Metrik → sonraki içerik ağırlığı (#5)

**Pazarlama KPI’ları (aspirasyonel, ayrı takip):** aylık reach / engagement / site trafiği — mühendislik AC değil.

## Çözüm (hibrit, Content Studio önce)

```
Content Studio (studio.egitim.today)
  → onaylı draft’lar
  → native OAuth publishers (FB/IG/LI/YT/TikTok/X)
  → (opsiyonel) Zapier webhook dışarı — kritik değil
```

**Zapier / ContentStudio SaaS / Mailchimp** = nice-to-have, çekirdek yol değil.

## Phase 0 — Dev / sandbox (ayrı issue)

→ Child: Meta App Review & sandbox hardening

## Phase 1 — Segmentasyon

→ Child: Audience segments for distribution

## Phase 2+ — Strateji / üretim / dağıtım

Mevcut pipeline + #2 / #7 / #5 ile örtüşür; yeni epic altında takip.

## Acceptance (Must)

- [ ] Onaylı içerik → en az FB + LI + IG (mümkün olanlar) otomatik/yarı-otomatik
- [ ] Segment etiketleri uygulanıyor
- [ ] Rate limit / spam koruması (batch + gap + early stop)
- [ ] Production token’lar App Review / Live gereksinimlerini karşılıyor

## Out of scope / düzeltmeler (orijinal taslaktan)

| Orijinal | Karar |
|----------|--------|
| “Connect Studio” | → **Content Studio** |
| Zapier kritik hub | → opsiyonel; native API öncelik |
| ContentStudio.com $25/ay | → ürünümüzle çakışır; alma |
| Canva Pro zorunlu | → mevcut AI/görsel pipeline |
| Reach 100K AC | → pazarlama hedefi, issue AC değil |
| Phase 0 “hepsi [x]” | → yanlış; çoğu kısmen / App Review açık |

## Risks

- Meta App Review gecikmesi / reddi
- Spam rate limit (FB 400 spam mesajı)
- X API ücretli tier
- Supabase connection / Hobby Vercel timeout

## Next

1. Meta App Review + Live (child issue)
2. Segmentasyon modeli (child issue)
3. #2 publishers kapanışını bu epic’e bağla
