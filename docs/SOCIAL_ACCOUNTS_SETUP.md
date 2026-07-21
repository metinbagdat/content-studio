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

1. https://x.com → **@egitimtoday** (veya müsait handle)
2. https://developer.x.com/en/portal/dashboard → Project + App
3. **User authentication settings** → OAuth 2.0:
   - Type: Web App
   - Callback: `http://localhost:3100/api/social/callback/twitter`
   - Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
4. `.env`:
   ```env
   X_CLIENT_ID="..."
   X_CLIENT_SECRET="..."
   X_CALLBACK_URL="http://localhost:3100/api/social/callback/twitter"
   ```

Content Studio X OAuth **PKCE S256** kullanır (Twitter zorunluluğu).

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
