# Sosyal medya hesapları — egitim.today (Content Studio)

Henüz hesap yoksa sırayla aç. Content Studio’da OAuth env dolunca `/admin/social` üzerinden bağlanırsın.

## Öncelik sırası (Faz 1)

| Platform | Hesap adı önerisi | Neden önce |
|----------|-------------------|------------|
| **LinkedIn** | egitim.today veya LearnCon | Eğitim B2B, güven, uzun metin |
| **X (Twitter)** | @egitimtoday | Kısa tanıtım, blog linkleri |
| YouTube | egitim.today | Faz 2 video |
| TikTok | egitim.today | Faz 2 kısa video |
| Facebook | egitim.today | Faz 3 |
| Instagram | egitim.today | Faz 3 |

---

## 1. LinkedIn (Şirket sayfası + kişisel)

1. https://www.linkedin.com/ → kayıt / giriş  
2. **Sayfa oluştur:** Menü → **Pages** → **Create a Company Page**  
   - İsim: **egitim.today** veya **LearnCon**  
   - Website: https://egitim.today  
   - Sektör: E-Learning / Education  
3. Logo + kapak (egitim.today markası)  
4. **Developer app (OAuth için):**  
   - https://www.linkedin.com/developers/apps → **Create app**  
   - App adı: `Content Studio egitim`  
   - LinkedIn Page: az önce oluşturduğun sayfa  
   - **Auth** → Redirect URL:  
     `http://localhost:3100/api/social/callback/linkedin`  
     (prod: `https://studio.egitim.today/...` veya deploy URL)  
   - Products: **Share on LinkedIn**, **Sign In with LinkedIn**  
   - **Client ID** + **Client Secret** → `content-studio/.env`:
     ```env
     LINKEDIN_CLIENT_ID="..."
     LINKEDIN_CLIENT_SECRET="..."
     LINKEDIN_CALLBACK_URL="http://localhost:3100/api/social/callback/linkedin"
     ```
5. Content Studio: `/admin/social` → OAuth URL veya dry-run test

---

## 2. X (Twitter)

1. https://x.com/i/flow/signup → **@egitimtoday** (veya müsait handle)  
2. Profil: bio + https://egitim.today link  
3. **Developer Portal:** https://developer.x.com/en/portal/dashboard  
   - Proje + App oluştur  
   - **User authentication settings** → OAuth 2.0  
   - Callback: `http://localhost:3100/api/social/callback/twitter`  
   - Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`  
4. `.env`:
   ```env
   X_CLIENT_ID="..."
   X_CLIENT_SECRET="..."
   X_CALLBACK_URL="http://localhost:3100/api/social/callback/twitter"
   ```
5. Free tier API limitlerini kontrol et (aylık post kotası)

---

## 3. YouTube (Faz 2 — video)

1. Google hesabı → https://www.youtube.com/create_channel  
2. Kanal adı: **egitim.today**  
3. Google Cloud Console → OAuth + YouTube Data API v3  
4. Content Studio Faz 2’de upload eklenecek

---

## 4. TikTok (Faz 2)

1. https://www.tiktok.com/signup — işletme hesabı tercih et  
2. https://developers.tiktok.com/ → app + Content Posting API (onay süreci uzun olabilir)

---

## 5. Facebook / Instagram (Faz 3)

1. Meta Business Suite: https://business.facebook.com/  
2. Facebook Sayfa + Instagram profesyonel hesap bağla  
3. Meta for Developers → app → Pages / Instagram Graph API

---

## Content Studio’da test (hesap yokken)

OAuth olmadan:

1. `/admin/social` → **Dry-run X bağla** / **Dry-run LinkedIn bağla**  
2. `/admin/review` → SOCIAL_CAPTION **Onayla**  
3. **Şimdi yayınla** → mock platform ID (gerçek SM’de görünmez)

Gerçek yayın için yukarıdaki OAuth env + hesaplar şart.

---

## İçerik stratejisi (bu makale)

Kaynak: [Zamanı Zafere Dönüştürmek](https://www.egitim.today/blog/zamani-zafere-donusturmek)

Pipeline üretir: caption, video script, podcast script, blog SEO, marş, şarkı sözü → `/admin/review` onay → SM’ye schedule.

CTA her postta: **https://egitim.today**
