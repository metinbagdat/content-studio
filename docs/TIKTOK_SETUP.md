# TikTok OAuth & Video Publish

TikTok entegrasyonu PR #28 ile eklendi. Dry-run kartı, env tanımlı değilse veya OAuth bağlanmadıysa görünür.

## 1. TikTok Developer Portal

1. [developers.tiktok.com](https://developers.tiktok.com/) → **Manage apps** → Create app
2. **Login Kit** → Redirect URI — **tab önemli**:

| Ortam | Tab | URI |
|-------|-----|-----|
| Local | **Desktop** | `http://localhost:3100/api/social/callback/tiktok` |
| Prod | **Web** | `https://studio.egitim.today/api/social/callback/tiktok` |

**Desktop kapalıysa:** App → **Settings** (veya Login Kit yapılandırması) → **Platforms** → **Desktop** kutusunu işaretleyin → kaydedin → Login Kit’te Desktop Redirect URI alanı açılır.

Web tab yalnızca `https://` kabul eder. Local `client_key` hatası genelde URI’nin Web tab’da veya Sandbox test hesabı eksik olmasından kaynaklanır.

3. **Sandbox** (review öncesi OAuth)

Portal → uygulama → **Sandbox** sekmesi:

1. **Add account** → TikTok ile giriş yapın (test edeceğiniz hesap)
2. Login Kit redirect URI’leri Sandbox’ta da tanımlı olmalı (Desktop + Web)
3. OAuth yalnızca bu Sandbox hesabıyla çalışır (review onaylanana kadar)

Sandbox alanları boşsa: önce Desktop platformunu açın, redirect URI ekleyin, sonra Sandbox’a test hesabı ekleyin.

4. **Content Posting API** etkinleştir
5. **URL property doğrulama** — iki yol:

### A) Domain (önerilen — tek seferde tüm path'ler)

- Property type: **Domain** → `studio.egitim.today`
- Method: **DNS TXT**
- DNS panelinde (egitim.today zone):

| Type | Name/Host | Value |
|------|-----------|--------|
| TXT | `studio` | `tiktok-developers-site-verification=cZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ` |

Doğrulandıktan sonra Terms, Privacy ve Web URL otomatik geçer.

### B) URL prefix (signature file)

TikTok hangi prefix'i doğruluyorsa dosya **o prefix altında** olmalı:

| Prefix | Dosya URL |
|--------|-----------|
| `https://studio.egitim.today` | `/tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ.txt` |
| `https://studio.egitim.today/legal/terms` | `/legal/terms/tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ.txt` |
| `https://studio.egitim.today/legal/privacy` | `/legal/privacy/tiktokcZ6afbMSmeXfrvDVHDI20MKXqoy52cVQ.txt` |

**Hata:** `legal/terms/` için verify edip dosyayı sadece kökte bırakmak → "couldn't find verification signature"

5. **App details:** Website URL, Privacy/Terms URL, app icon, category
6. **Test users / Sandbox:** Review öncesi portalda test TikTok hesabı ekleyin
7. **Content Posting API:** Ürün kartında "Apply" varsa başvurun

## 2. Env — yerel (.env.local) + Vercel Environment Variables

Aynı `TIKTOK_CLIENT_KEY` ve `TIKTOK_CLIENT_SECRET` **her iki yerde** de olmalı.

**Yerel** (`.env.local`):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3100
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
# Portal URI ile birebir (Desktop tab, sondaki / dahil):
TIKTOK_CALLBACK_URL=http://localhost:3100/api/social/callback/tiktok/
TIKTOK_REDIRECT_TRAILING_SLASH=true
```

**Prod** (Vercel → Settings → Environment Variables → Production):

```env
NEXT_PUBLIC_APP_URL=https://studio.egitim.today
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

Opsiyonel:

```env
TIKTOK_AUDITED=false
TIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONE
TIKTOK_OAUTH_SCOPES=user.info.basic,video.upload
```

Vercel'de env ekledikten sonra **Redeploy** gerekir.

## 3. Studio'da bağlama

1. PR #29 merge + deploy (TikTok OAuth butonu UI)
2. Sosyal → TikTok → dry-run varsa **Kes** → **OAuth bağla**
3. Önce local'de test; aynı DB ile prod da hesabı görür
4. Yayın: `SHORT_VIDEO_SCRIPT` → MP4 → TikTok API

## 4. Modlar

| Mod | Scope | Davranış |
|-----|-------|----------|
| Onaysız (varsayılan) | `video.upload` | Video TikTok inbox — uygulamadan onayla |
| Onaylı | `video.publish` | Doğrudan feed (`TIKTOK_AUDITED=true`) |

## 5. Env dışında yapılacaklar

| Adım | Zorunlu? |
|------|----------|
| Login Kit + Content Posting API | Evet |
| Local + prod redirect URI (2 adet) | Evet |
| Test kullanıcı ekleme (sandbox) | Review öncesi evet |
| Privacy Policy + Terms URL | Review için evet |
| Content Posting API başvurusu | Ürün kapalıysa evet |
| App audit (`video.publish`) | Doğrudan feed için evet |
| Webhook | Hayır |

## 6. Sorun giderme

- **dry-run** → env eksik veya `npm run dev` restart gerekli
- **client_key (local)** → Desktop platform açık mı? URI Desktop tab’da mı? Sandbox test hesabı eklendi mi?
- **studio.egitim.today açılmıyor (NXDOMAIN)** → DNS: `studio` CNAME → `cname.vercel-dns.com` (Vercel → Domains). Son deploy başarılı olmalı.
- **Redirect URI mismatch** → portal URI = callback birebir (sondaki `/` dahil; gerekirse `TIKTOK_REDIRECT_TRAILING_SLASH=true`)
- **OAuth not authorized** → Sandbox test user listesine hesap ekle
- **Upload OK, feed'de yok** → onaysız mod: TikTok app → Inbox

Paralel kurulum: [LOCAL_AND_PROD.md](./LOCAL_AND_PROD.md)
