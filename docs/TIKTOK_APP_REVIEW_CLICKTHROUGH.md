# TikTok App Review — portal tıklama rehberi (~15 dk)

Agent TikTok Developer Portal'a giriş yapamaz. Sandbox OAuth + demo video **senin tarayıcında**.

---

## Red: "Website is not accessible" (2026-08)

**Kök neden:** Yanlış Website URL veya prod'da static doğrulama dosyası 404 (monorepo Vercel — düzeltildi).

**Portalda güncelle (App details):**

| Alan | Değer |
|------|--------|
| **Website URL** | `https://studio.egitim.today` |
| Privacy Policy URL | `https://studio.egitim.today/legal/privacy` |
| Terms of Service URL | `https://studio.egitim.today/legal/terms` |

Deploy sonrası tarayıcıda aç — hepsi 200 olmalı. Sonra **Resubmit**.

**Kullanma:** `www.egitim.today`, `www.studio.egitim.today`, `egitim.today` (www olmadan).

---

## Ön koşullar

- [ ] `docs/TIKTOK_SETUP.md` — Desktop platform + Sandbox test hesabı
- [ ] DNS TXT veya signature file doğrulandı
- [ ] Vercel'de `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`

Privacy: `https://studio.egitim.today/legal/privacy`

---

## A) Video

```powershell
cd C:\Users\mb\content-studio
$env:ADMIN_API_KEY = "prod-admin-key"
npm install
npx playwright install chromium
npm run tiktok:record-review
```

Script duraklatır → TikTok OAuth (Sandbox hesabı) → video yükle akışı.

Alternatif: `Win + G` ile manuel kayıt — `https://studio.egitim.today/admin/social`

---

## B) Submit — developers.tiktok.com

1. App → **Review** / **Submit for review**
2. Demo video yükle (gerçek ekran kaydı)
3. Metin: `docs/TIKTOK_APP_REVIEW_SUBMISSION.md` içindeki English bloğu yapıştır
4. Content Posting API scope açıklaması: yalnızca kendi egitim.today hesabı, admin onaylı upload

---

## X (2–3 gün sonra)

X API kredisi gelince:

```powershell
npx tsx scripts/prod-social-drain.mjs --platform X
```

150 FAILED post yeniden denenecek.
