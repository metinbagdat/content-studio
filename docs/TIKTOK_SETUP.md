# TikTok OAuth & Video Publish

TikTok entegrasyonu PR #28 ile eklendi. Dry-run kartı, env tanımlı değilse veya OAuth bağlanmadıysa görünür.

## 1. TikTok Developer Portal

1. [developers.tiktok.com](https://developers.tiktok.com/) → **Manage apps** → Create app
2. **Products** ekle:
   - **Login Kit** (OAuth giriş)
   - **Content Posting API** (video yükleme — bazen ayrı onay/başvuru ister)
3. **Redirect URI** — **ikisini de** ekle (local öncelik + prod paralel):

```
http://localhost:3100/api/social/callback/tiktok
https://studio.egitim.today/api/social/callback/tiktok
```

4. **App details** (genelde zorunlu):
   - **Website URL:** `https://studio.egitim.today`
   - **Privacy Policy URL** ve **Terms of Service URL** (review için)
   - **App icon / category** doldur
5. **Test users / Sandbox:** Review öncesi yalnızca portalda eklediğiniz TikTok hesapları OAuth yapabilir
6. **Content Posting API erişimi:** Ürün kartında "Apply" varsa başvurun; onaysız modda `video.upload` (inbox) çalışır

## 2. Env — yerel (.env.local) + Vercel Environment Variables

Aynı `TIKTOK_CLIENT_KEY` ve `TIKTOK_CLIENT_SECRET` **her iki yerde** de olmalı.

**Yerel** (`.env.local`):

```env
NEXT_PUBLIC_APP_URL=http://localhost:3100
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
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

- **dry-run** → env eksik veya redeploy/dev restart gerekli
- **Redirect URI mismatch** → portal URI = callback birebir
- **OAuth not authorized** → test user listesine hesap ekle
- **Upload OK, feed'de yok** → onaysız mod: TikTok app → Inbox

Paralel kurulum: [LOCAL_AND_PROD.md](./LOCAL_AND_PROD.md)
