# Meta App Review — gerçek ekran kaydı (zorunlu)

Meta resmi beklenti: **gerçek screen recording** — uygulamayı gerçek tarayıcıda kullanarak, reviewer'ın kendi test hesabıyla **aynı adımları tekrar edebileceği** bir akış.

**Göndermeyin:** `scripts/generate-meta-app-review-video.ts` çıktısı (`public/meta-app-review-pages-manage-posts.mp4`). Bu dosya SVG slaytlar + ffmpeg zoompan ile üretilmiş **storyboard / prova**; slayt 3'teki Facebook OAuth ekranı **gerçek `facebook.com/.../dialog/oauth` değil**, taklit SVG'dir. Reviewer reproduce edemez → **red riski yüksek**.

**Gönderin:** OBS, Windows Game Bar (`Win+G`), veya Camtasia ile çekilmiş **gerçek tarayıcı kaydı** MP4.

---

## İzin başına ayrı video

Meta: **tek videoda birden fazla izin göstermeyin.** Her permission için ayrı screencast.

| İzin | Video | Script / storyboard |
|------|--------|---------------------|
| `pages_manage_posts` | Video 1 — Facebook Page yayın | `npm run meta:record-fb-review` · storyboard: `generate-meta-app-review-video.ts` |
| `instagram_content_publish` | Video 2 — Instagram yayın | `npm run meta:record-ig-review` · storyboard: `generate-meta-ig-app-review-video.ts` |
| `pages_read_engagement` | Video 3 (opsiyonel) — metrik okuma | Manuel kayıt |

### Tek OAuth, iki video

`metaOAuthPublishScopes()` + `META_LOGIN_CONFIG_ID_PUBLISH=919581157862599` **tek** Facebook Login for Business ekranında hem `pages_manage_posts` hem `instagram_content_publish` verir.

Yine de Meta **izin başına ayrı video** ister:

| Video | OAuth | Gösterilecek kullanım |
|-------|-------|------------------------|
| **Video 1 (FB)** | Facebook kartından OAuth (gerçek facebook.com) | Sadece **Page'e Yayınla** → facebook.com/Egitim.today |
| **Video 2 (IG)** | Instagram kartından OAuth *veya* zaten Bağlı (Video 1'de OAuth gösterildiyse kısa/atla OK) | Sadece **IG DRAFT → Yayınla** → instagram.com/egitim.today |

**Video 1'de IG yayını gösterme.** **Video 2'de FB yayını gösterme.**

İlk başvuruda yalnızca `pages_manage_posts` istiyorsanız Video 1 yeter. IG Advanced Access için Video 2 ayrı submission.

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
npm run meta:record-fb-review   # gerçek kayıt Video 1
```

---

## Storyboard → gerçek kayıt (`instagram_content_publish`) — Video 2

| # | Ne göster | Gerçek URL / ekran | Süre |
|---|-----------|-------------------|------|
| 1 | Admin API key → **Yenile** — **Instagram kartı** | `https://studio.egitim.today/admin/social` | ~30s |
| 2 | Instagram kartı → **Kes** → **OAuth bağla** | Aynı sayfa (FB kartına dokunma) | ~20s |
| 3 | **Gerçek** Facebook Login for Business — IG Business hesabı, Allow | `facebook.com/.../dialog/oauth` | ~45s veya atla* |
| 4 | Callback → Instagram **Bağlı** | `studio.egitim.today/admin/social` | ~15s |
| 5 | Instagram **DRAFT** (görsel URL prod'da HTTPS) → **Yayınla** | Aynı sayfa | ~30s |
| 6 | **instagram.com** profilde yeni post | `https://www.instagram.com/egitim.today/` | ~20s |

\* Video 1'de aynı OAuth zaten gösterildiyse Video 2'de Instagram zaten **Bağlı** olabilir — OAuth adımını atlayıp doğrudan yayın + profil kanıtı yeterli.

**IG görsel zorunlu:** localhost görsel URL çalışmaz; prod `studio.egitim.today` üzerinden public image URL gerekir.

### Kayıt

```bash
npm run meta:record-ig-review
# veya Win+G manuel — storyboard prova:
npx tsx scripts/generate-meta-ig-app-review-video.ts
```

Dosya adı: `meta-instagram-content-publish-screencast-YYYY-MM-DD.mp4`

---

## TikTok demo video

`scripts/generate-tiktok-demo-video.ts` de aynı şekilde **SVG storyboard** — TikTok review için de **gerçek kayıt** tercih edin: OAuth bağla → video yükle → TikTok inbox/onay akışı (uygulama durumunuza göre).

---

## Checklist (submit öncesi)

- [ ] **Video 1 (FB):** gerçek screen capture — sadece `pages_manage_posts`
- [ ] **Video 2 (IG):** ayrı gerçek kayıt — sadece `instagram_content_publish` (IG başvurusu varsa)
- [ ] Adım 3 gerçek `facebook.com` OAuth ekranı (en az bir videoda)
- [ ] Privacy URL güncel: `https://studio.egitim.today/legal/privacy`
- [ ] Reviewer instructions İngilizce metin (`META_APP_REVIEW_SUBMISSION.md`)
- [ ] SVG storyboard MP4'leri **App Review'a yükleme**
