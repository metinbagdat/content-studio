# Meta App Review — portal tıklama rehberi (sen ~10 dk)

Agent Meta Developers hesabına giriş yapamaz. Video + Submit **senin tarayıcında**; metinler hazır (copy-paste).

---

## Önce: Advanced Access gerçekten gerekli mi?

**Sadece kendi** Egitim.today FB/IG hesaplarını sen (App Admin) kullanıyorsan → **Standard Access yeterli**, App Review **zorunlu değil**.

| Senaryo | App Review video + Submit |
|---------|---------------------------|
| Yalnızca sen yayınlarsın (Standard) | **Gerekmez** |
| Başka kullanıcılar sayfa bağlasın (Advanced) | **Gerekir** |

Prod'da FB zaten **289 yayın** — Standard çalışıyor. Advanced istemiyorsan bu rehberi **atla**.

---

## Durum (2026-08-23)

| Ne | Durum |
|----|--------|
| Business portfolio | **In review** (Meta Business — App Review'dan ayrı) |
| `pages_manage_posts` App Review Submit | **Henüz yapılmadı** |
| Privacy | ✅ egitim.today + studio.egitim.today |

---

## A) Video — gerçek kayıt

```powershell
cd C:\Users\mb\content-studio
$env:ADMIN_API_KEY = "prod-admin-key"
npx playwright install chromium
npx tsx scripts/record-meta-review-playwright.ts
```

OAuth adımında script durur — sen facebook.com'da **Allow** tıkla.

MP4: `ffmpeg -i "storage/meta-review-recordings/*.webm" -c:v libx264 -pix_fmt yuv420p meta-submit.mp4`

---

## B) Submit — developers.facebook.com

1. App `1309132857965857` → **Review** → **Uygulama İncelemesi**
2. Sadece **`pages_manage_posts`**
3. Metin: `docs/META_APP_REVIEW_SUBMISSION.md`
4. Gerçek MP4 yükle → Submit
