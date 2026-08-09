# OAuth callback URL'leri — studio.egitim.today

Prod base: **`https://studio.egitim.today`**

| Platform | Callback URL (aynen kopyala) |
|----------|--------------------------------|
| X (Twitter) | `https://studio.egitim.today/api/social/callback/twitter` |
| LinkedIn | `https://studio.egitim.today/api/social/callback/linkedin` |
| YouTube | `https://studio.egitim.today/api/social/callback/youtube` |
| Facebook | `https://studio.egitim.today/api/social/callback/facebook` |
| Instagram | `https://studio.egitim.today/api/social/callback/instagram` |
| TikTok | `https://studio.egitim.today/api/social/callback/tiktok` |

Vercel env (Production):

```env
NEXT_PUBLIC_APP_URL=https://studio.egitim.today
X_CALLBACK_URL=https://studio.egitim.today/api/social/callback/twitter
LINKEDIN_CALLBACK_URL=https://studio.egitim.today/api/social/callback/linkedin
YOUTUBE_CALLBACK_URL=https://studio.egitim.today/api/social/callback/youtube
FACEBOOK_CALLBACK_URL=https://studio.egitim.today/api/social/callback/facebook
INSTAGRAM_CALLBACK_URL=https://studio.egitim.today/api/social/callback/instagram
TIKTOK_CALLBACK_URL=https://studio.egitim.today/api/social/callback/tiktok
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
META_LOGIN_CONFIG_ID=1680236466390744
```

---

## 1. Meta (Facebook + Instagram)

**Nereye:** [developers.facebook.com](https://developers.facebook.com) → App → **Facebook Login for Business** → **Settings**

**Valid OAuth Redirect URIs** — her satır ayrı ekle:

```
https://studio.egitim.today/api/social/callback/facebook
https://studio.egitim.today/api/social/callback/instagram
```

Local dev için (opsiyonel, otomatik de olabilir):

```
http://localhost:3100/api/social/callback/facebook
http://localhost:3100/api/social/callback/instagram
```

**Configuration ID** (Login for Business → Configurations):

| Config | ID | Kullanım |
|--------|-----|----------|
| pages_show_list | `1680236466390744` | **Prod `.env` / Vercel** → `META_LOGIN_CONFIG_ID` |
| (eski) | `1527817658530867` | yerine yukarıdakini kullan |

**App domains** (Settings → Basic): `egitim.today` — **studio** subdomain yazma.

---

## 2. LinkedIn

**Nereye:** [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → uygulama → **Auth** → **OAuth 2.0 settings**

**Authorized redirect URLs for your app:**

```
https://studio.egitim.today/api/social/callback/linkedin
```

---

## 3. YouTube (Google Cloud)

**Nereye:** [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → **Credentials** → OAuth 2.0 Client ID (Web)

**Authorized redirect URIs:**

```
https://studio.egitim.today/api/social/callback/youtube
```

---

## 4. X (Twitter)

**Nereye:** [console.x.com](https://console.x.com) → Apps → uygulama → **User authentication settings** → Edit

| Alan | Değer |
|------|--------|
| Callback URI / Redirect URL | `https://studio.egitim.today/api/social/callback/twitter` |
| Website URL | `https://www.egitim.today` |

---

## 5. TikTok

**Nereye:** [developers.tiktok.com](https://developers.tiktok.com/) → App → **Login Kit** + **Content Posting API**

**Redirect URIs** (ikisini de ekle — local + prod paralel):

```
https://studio.egitim.today/api/social/callback/tiktok
http://localhost:3100/api/social/callback/tiktok
```

**Website URL:** `https://studio.egitim.today`

---

## Kontrol

Deploy sonrası `/admin/social` → OAuth env kontrolü kartında **Callback:** satırları `studio.egitim.today` göstermeli.

OAuth hata `redirect_uri_mismatch` → portal URL ile Vercel `*_CALLBACK_URL` birebir aynı olmalı (http/https, slash).
