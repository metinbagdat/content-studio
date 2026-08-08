# Sosyal medya hesapları — egitim.today (Content Studio)

OAuth env dolunca `/admin/social` → **OAuth ile X/LinkedIn bağla**.

## Hızlı checklist

- [ ] LinkedIn şirket sayfası oluştur (egitim.today)
- [ ] LinkedIn Developer app + Products: Share on LinkedIn
- [ ] X @egitimtoday + Developer Portal OAuth 2.0 app
- [ ] `.env` / `.env.local` client ID/secret + callback URL
- [ ] `npm run dev` yeniden başlat
- [ ] `/admin/social` → OAuth bağla → caption onayla → yayınla

---

## Öncelik sırası (Faz 1)

| Platform | Hesap | OAuth env |
|----------|-------|-----------|
| **LinkedIn** | egitim.today şirket sayfası | `LINKEDIN_*` + opsiyonel `LINKEDIN_ORGANIZATION_ID` |
| **X** | @egitimtoday | `X_*` |

---

## 1. LinkedIn

### Hesap + sayfa
1. https://www.linkedin.com/ → giriş
2. **Pages → Create a Company Page** — egitim.today, https://egitim.today

### Developer app
1. https://www.linkedin.com/developers/apps → **Create app**
2. App adı: `Content Studio egitim` · bağlı LinkedIn Page seç
3. **Auth** tab → Redirect URLs:
   ```
   http://localhost:3100/api/social/callback/linkedin
   ```
4. **Products** → **Share on LinkedIn** + **Sign In with LinkedIn using OpenID Connect**
5. Client ID + Secret → `.env`:
   ```env
   LINKEDIN_CLIENT_ID="..."
   LINKEDIN_CLIENT_SECRET="..."
   LINKEDIN_CALLBACK_URL="http://localhost:3100/api/social/callback/linkedin"
   ```

### Şirket sayfasına post (önerilen)
1. LinkedIn Page → **Admin tools** → sayfa URL’sindeki sayı veya About → **Page ID**
2. `.env`:
   ```env
   LINKEDIN_ORGANIZATION_ID="12345678"
   ```
3. OAuth scope otomatik: `w_organization_social` — postlar **egitim.today** sayfasından gider

Kişisel post için `LINKEDIN_ORGANIZATION_ID` boş bırak.

Kişisel post için `LINKEDIN_ORGANIZATION_ID` boş bırak.

---

## 2b. YouTube (Google OAuth)

### Google Cloud hazırlık
1. [console.cloud.google.com](https://console.cloud.google.com) → proje
2. **APIs & Services → Library** → **YouTube Data API v3** → Enable
3. **OAuth consent screen** → User type: **External** → Testing
4. **Test users** → `metinbaghdat@gmail.com` ekle (Testing modunda sadece bunlar giriş yapabilir)
5. **Credentials → OAuth client ID** → Web application  
   Redirect URI:
   ```
   http://localhost:3100/api/social/callback/youtube
   ```
6. `.env`:
   ```env
   YOUTUBE_CLIENT_ID="....apps.googleusercontent.com"
   YOUTUBE_CLIENT_SECRET="..."
   YOUTUBE_CALLBACK_URL="http://localhost:3100/api/social/callback/youtube"
   ```

### "Google hasn't verified this app" — normal
Testing modunda bu ekran çıkar. Kendi uygulaman → **Continue** / **Devam et** → izinleri onayla.
- Test users: `metinbaghdat@gmail.com` ekli olmalı
- Privacy Policy (opsiyonel): OAuth consent → `https://egitim.today` veya geçici `http://localhost:3100`

### Content Studio'da bağla
1. OAuth sırasında worker'ı durdur (pool timeout önlemek için)
2. `/admin/social` → YouTube → **OAuth bağla** → **API test**

### Test kullanıcısı vs production
| Mod | Kim giriş yapabilir? |
|-----|----------------------|
| **Testing** (şimdi) | Sadece Test users listesindeki Gmail hesapları (max ~100) |
| **Production** | Herkes — ama `youtube.upload` için Google **App Verification** gerekir |

**egitim.today için pratik yol:** Tek kanal / tek Gmail yeterliyse Testing modunda kalıp yalnızca `metinbaghdat@gmail.com` (veya kanal Gmail'i) test user olarak eklemen yeterli — **normal kullanıcı eklemen gerekmez**.

Herkese açık uygulama veya farklı Google hesapları bağlanacaksa: OAuth consent → **Publish App** + Google doğrulama süreci (birkaç hafta).

---

## 3. X (Twitter)

**2026 portal:** https://console.x.com (Dashboard + Apps listesi - dogru yer)

### OAuth 2.0 Client ID nerede?

1. console.x.com -> sol menu **Apps** (veya Dashboard sagdaki app karti)
2. Uygulama sec (ornegin egitimtoday, ID 33245535)
3. Ust **Keys and tokens** sekmesi
4. **OAuth 2.0 Client ID** -> `X_CLIENT_ID` | **Client Secret** -> `X_CLIENT_SECRET`
5. **API Key / API Key Secret** (OAuth 1.0a) -> kullanmayin

### User authentication (callback)

1. https://x.com -> **@egitimtoday** (veya müsait handle)
2. console.x.com -> Apps -> uygulama -> **Settings**
3. **User authentication settings** -> OAuth 2.0:
   - Type: Web App
   - Callback: `http://localhost:3100/api/social/callback/twitter`
   - Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
4. `.env`:
   ```env
   X_CLIENT_ID="..."
   X_CLIENT_SECRET="..."
   X_CALLBACK_URL="http://localhost:3100/api/social/callback/twitter"
   ```

Content Studio X OAuth **PKCE S256** kullanir (Twitter zorunlulugu).

### X "Something went wrong" hatasi

OAuth ekraninda bu mesaj genelde **Developer Portal ayari** eksik/yanlis demektir (Content Studio kodu degil):

1. https://developer.x.com/en/portal/dashboard - App sec
2. **User authentication settings** - **Set up** veya **Edit**
3. **OAuth 2.0** acik, Type: **Web App** (Automated App degil)
4. **Callback URI / Redirect URL** - **tam eslesme** (sonunda `/` yok):
   ```
   http://localhost:3100/api/social/callback/twitter
   ```
5. **Website URL** (zorunlu olabilir): `http://localhost:3100`
6. **App permissions**: Read and write
7. `.env` icinde **OAuth 2.0 Client ID** kullanin (API Key / API Secret degil)
8. Callback degistirdikten sonra portalda **Save** - bazen Client ID yenilenir
9. `npm run dev` yeniden baslat, `/admin/social` - tekrar OAuth

Hala hata: portalda ikinci callback olarak `http://127.0.0.1:3100/api/social/callback/twitter` ekleyin ve `.env`:
```env
X_CALLBACK_URL="http://127.0.0.1:3100/api/social/callback/twitter"
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3100"
```

---

## 3. Content Studio’da bağlama

1. Env kaydet → `npm run dev` restart
2. http://localhost:3100/admin/social
3. **OAuth ile X bağla** / **OAuth ile LinkedIn bağla**
4. Callback sonrası yeşil **oauth** rozeti görünür
5. Onaylı caption varsa taslaklar otomatik senkron (`sync-drafts`)

### Dry-run (hesap/API yokken)
- **Dry-run X/LinkedIn** → mock publish (gerçek SM’de görünmez)

---

## 4. Prod callback — studio.egitim.today

Tam liste ve portal adımları: **[OAUTH_CALLBACKS_PRODUCTION.md](./OAUTH_CALLBACKS_PRODUCTION.md)**

```
https://studio.egitim.today/api/social/callback/twitter
https://studio.egitim.today/api/social/callback/linkedin
https://studio.egitim.today/api/social/callback/youtube
https://studio.egitim.today/api/social/callback/facebook
https://studio.egitim.today/api/social/callback/instagram
```

| Portal | Menü yolu |
|--------|-----------|
| **Meta** | App → Facebook Login for Business → **Settings** → Valid OAuth Redirect URIs |
| **LinkedIn** | App → **Auth** → Redirect URLs |
| **Google** | Credentials → OAuth client → Authorized redirect URIs |
| **X** | App → User authentication → Callback URI |

Vercel'de `NEXT_PUBLIC_APP_URL=https://studio.egitim.today` + yukarıdaki `*_CALLBACK_URL` env'leri.

---

## 5. Faz 2 — Pipeline platformları (şimdilik dry-run)

Caption/video pipeline şu platformlar için içerik üretir; **gerçek OAuth henüz yok**:

| Platform | Açılacak hesap | Şimdi ne yapılır |
|----------|----------------|------------------|
| **YouTube** | egitim.today kanalı | `/admin/social` → **Faz 2 dry-run hesapları tamamla** |
| **Instagram** | @egitim.today (Business) | Aynı — taslak + takvim testi |
| **TikTok** | @egitim.today | Aynı |
| **Facebook** | egitim.today sayfası | Aynı |
| **Pinterest** | egitim.today | Caption üretilir; DB hesap slotu yok (Faz 2 API) |

Dry-run postlar gerçek SM’de görünmez; onay → taslak → zamanlama akışını doğrular.

### Faz 2 OAuth (sıra önerisi)

1. **Podcast MP3 stabil** → YouTube Data API v3 (video/audio upload)
2. **Video pipeline** → TikTok for Developers
3. **Meta Business** → Instagram + Facebook Graph API (tek app) — ayrıntılı rehber: **[META_FACEBOOK_SETUP.md](./META_FACEBOOK_SETUP.md)**

Env şablonu: `.env.example` içinde yorum satırları.

---

## 6. Zorunlu `.env` özeti

```env
# Faz 1 — gerçek yayın
X_CLIENT_ID / X_CLIENT_SECRET
LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
LINKEDIN_ORGANIZATION_ID=""   # şirket sayfası Page ID (opsiyonel)
LINKEDIN_ORG_POST="false"     # true + yeniden OAuth → sayfadan post

# Otomasyon
SOCIAL_AUTOPILOT="true"
npm run worker                  # ayrı terminal — zamanlanmış yayın

NEXT_PUBLIC_APP_URL="http://localhost:3100"
TOKEN_ENCRYPTION_KEY="..."      # prod'da sabit kal — token bozulmasın
```

---

## İçerik akışı

Kaynak: [Zamanı Zafere Dönüştürmek](https://www.egitim.today/blog/zamani-zafere-donusturmek)

Pipeline → `/admin/review` onay → `/admin/social` yayın · CTA: **https://egitim.today**
