# TikTok OAuth & Video Publish

TikTok entegrasyonu PR #28 ile eklendi. Dry-run kartı, env tanımlı değilse veya OAuth bağlanmadıysa görünür.

## 1. TikTok Developer Portal

1. [developers.tiktok.com](https://developers.tiktok.com/) → uygulama oluştur
2. **Login Kit** + **Content Posting API** etkinleştir
3. **Redirect URI** (birebir):

```
https://studio.egitim.today/api/social/callback/tiktok
```

Local test:

```
http://localhost:3100/api/social/callback/tiktok
```

## 2. Vercel / .env.local

```env
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=https://studio.egitim.today
```

Opsiyonel:

```env
# Onaysız uygulama: video.upload → TikTok gelen kutusu (uygulamadan onayla)
# Onaylı uygulama: video.publish → doğrudan feed
TIKTOK_AUDITED=false
TIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONE
TIKTOK_OAUTH_SCOPES=user.info.basic,video.upload
```

## 3. Studio’da bağlama

1. Sosyal → TikTok kartı → **OAuth bağla**
2. Dry-run hesabı varsa önce **Kes**, sonra OAuth
3. Yayın: `SHORT_VIDEO_SCRIPT` / `VIDEO_SCRIPT` türevleri → MP4 üretilir → TikTok’a yüklenir

## 4. Modlar

| Mod | Scope | Davranış |
|-----|-------|----------|
| Onaysız (varsayılan) | `video.upload` | Video TikTok uygulamasında taslak/inbox — kullanıcı onaylar |
| Onaylı | `video.publish` | Doğrudan yayın (`TIKTOK_AUDITED=true`) |

## 5. Sorun giderme

- **dry-run görünüyor** → `TIKTOK_CLIENT_KEY` / `SECRET` Vercel’de tanımlı mı? Deploy sonrası OAuth bağla
- **env eksik badge** → env satırları Sosyal sayfasında kırmızı; redeploy gerekir
- **Redirect URI mismatch** → Portal URI ile callback birebir aynı olmalı (http vs https)
