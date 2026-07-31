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

---

## 2. X (Twitter)

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

## 4. Prod callback (ileride)

Deploy URL’nize göre güncelle:
```
https://studio.egitim.today/api/social/callback/twitter
https://studio.egitim.today/api/social/callback/linkedin
```
Developer portal + LinkedIn app’te aynı URL’leri ekle.

---

## İçerik akışı

Kaynak: [Zamanı Zafere Dönüştürmek](https://www.egitim.today/blog/zamani-zafere-donusturmek)

Pipeline → `/admin/review` onay → `/admin/social` yayın · CTA: **https://egitim.today**
