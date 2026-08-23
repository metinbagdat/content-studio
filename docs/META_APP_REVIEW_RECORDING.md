# Meta App Review — gerçek ekran kaydı (zorunlu)

Meta resmi beklenti: **gerçek screen recording** — uygulamayı gerçek tarayıcıda kullanarak, reviewer'ın kendi test hesabıyla **aynı adımları tekrar edebileceği** bir akış.

**Göndermeyin:** `scripts/generate-meta-app-review-video.ts` çıktısı (`public/meta-app-review-pages-manage-posts.mp4`). Bu dosya SVG slaytlar + ffmpeg zoompan ile üretilmiş **storyboard / prova**; slayt 3'teki Facebook OAuth ekranı **gerçek `facebook.com/.../dialog/oauth` değil**, taklit SVG'dir. Reviewer reproduce edemez → **red riski yüksek**.

**Gönderin:** OBS, Windows Game Bar (`Win+G`), veya Camtasia ile çekilmiş **gerçek tarayıcı kaydı** MP4.

---

## İzin başına ayrı video

Meta: **tek videoda birden fazla izin göstermeyin.** Her permission için ayrı screencast.

| İzin | Video |
|------|--------|
| `pages_manage_posts` | Bu dokümandaki 6 adım (Facebook Page yayın) |
| `instagram_content_publish` | Ayrı kayıt — sadece IG yayın akışı |
| `pages_read_engagement` | Ayrı kayıt — sadece metrik okuma (varsa) |

Şu an ilk başvuru: yalnızca **`pages_manage_posts`**.

---

## Storyboard → gerçek kayıt (`pages_manage_posts`)

Script'teki sıra aynı; **ekran mock değil, prod veya localhost gerçek UI**.

| # | Ne göster | Gerçek URL / ekran | Süre |
|---|-----------|-------------------|------|
| 1 | Admin API key gir → **Yenile** → Sosyal dashboard | `https://studio.egitim.today/admin/social` | ~30s |
| 2 | Facebook kartı → gerekirse **Kes** → **OAuth bağla** | Aynı sayfa | ~20s |
| 3 | **Gerçek** Facebook Login for Business — izin ekranı, Page seçimi, Allow | `facebook.com/.../dialog/oauth` (gerçek Meta UI) | ~45s |
| 4 | Callback → dashboard'da Facebook **Bağlı** | `studio.egitim.today/admin/social` | ~15s |
| 5 | Bir **DRAFT** → **Yayınla** (toplu değil, tek post) | Aynı sayfa | ~30s |
| 6 | **facebook.com** üzerinde Egitim.today sayfasında yeni post | `https://www.facebook.com/Egitim.today` | ~20s |

**Toplam:** ~2–4 dk, 1920×1080 veya 1280×720, ses opsiyonel (sessiz OK).

### Kayıt ipuçları

- Tarayıcı zoom **%100**; adres çubuğu görünsün (özellikle adım 3'te `facebook.com` domain'i).
- Adım 3 **atlanamaz** — mock/slide yerine gerçek OAuth consent.
- Prod kullanıyorsanız: Vercel `ADMIN_API_KEY` (local `admin123` prod'da çalışmaz).
- Spam limiti: tek **Yayınla**; toplu yayın göstermeyin.
- Login Config: `919581157862599` (`pages_manage_posts`).

### Dosya adı (yüklerken)

Örn. `meta-pages-manage-posts-screencast-2026-08-23.mp4` — Meta wizard → Reviewer instructions → Upload.

Storyboard MP4 üretmek (iç prova, **submit etme**):

```bash
npx tsx scripts/generate-meta-app-review-video.ts
```

---

## TikTok demo video

`scripts/generate-tiktok-demo-video.ts` de aynı şekilde **SVG storyboard** — TikTok review için de **gerçek kayıt** tercih edin: OAuth bağla → video yükle → TikTok inbox/onay akışı (uygulama durumunuza göre).

---

## Checklist (submit öncesi)

- [ ] Video gerçek screen capture (mock SVG değil)
- [ ] Adım 3 gerçek `facebook.com` OAuth ekranı
- [ ] Sadece `pages_manage_posts` — başka izin aynı videoda yok
- [ ] Privacy URL güncel: `https://studio.egitim.today/legal/privacy` (+ `https://www.egitim.today/privacy#sosyal-medya`)
- [ ] Reviewer instructions İngilizce metin (`META_APP_REVIEW_SUBMISSION.md`)
- [ ] Test user: App Administrator, Page admin
