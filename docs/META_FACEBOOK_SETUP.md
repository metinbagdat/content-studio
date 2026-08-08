# Meta (Facebook + Instagram) — Adım adım kurulum

Content Studio Instagram ve Facebook yayını için **Meta Developer** uygulaması gerekir. YouTube gibi tek OAuth ile ikisi birlikte bağlanır.

---

## Ön koşullar

| Gereksinim | Nasıl |
|------------|--------|
| Facebook hesabı | Kişisel hesap yeterli (geliştirici kaydı için) |
| Facebook **Sayfa** | [facebook.com/pages/create](https://www.facebook.com/pages/create) → **egitim.today** |
| Instagram **Business/Creator** | Ayarlar → Hesap türü → Profesyonel → Facebook sayfasına bağla |
| Telefon | Meta doğrulama kodu (bazen gecikir — 24–48 saat bekleyin) |

Instagram hesabınız `metinbaghdat2026` ise: **Profesyonel hesap** + **Facebook sayfasına bağlı** olmalı.

---

## 1. Meta Developer hesabı

1. https://developers.facebook.com/ → **Get Started** / **Başlayın**
2. Facebook hesabınızla giriş
3. **Verify account** — e-posta + telefon (SMS gelmezse **Voice call** deneyin)
4. **Developer registration** anketini doldurun (kullanım: "Kendi işletmem için içerik yayını")

**Takılırsanız:** Telefon doğrulama gelmiyorsa 24 saat bekleyin veya farklı tarayıcı/gizli pencere. Meta bazen Türkiye numaralarında gecikir.

---

## 2. Uygulama oluşturma

1. https://developers.facebook.com/apps/ → **Create App**
2. Use case: **Other** → **Next**
3. App type: **Business** → **Next**  
   *(Consumer değil — Business Instagram/Facebook Page API için gerekli)*
4. App name: `egitim.today Content Studio`
5. App contact email: `metinbaghdat@gmail.com`
6. Business portfolio: **Create new** veya mevcut — **Create app**

**"App oluşturamıyorum" hataları:**

| Hata | Çözüm |
|------|--------|
| Developer account not verified | Adım 1 telefon/e-posta doğrulama |
| Business required | App type = **Business** seçin |
| Rate limit | 24 saat bekleyin, çok deneme yapmayın |
| Account restricted | facebook.com/help → hesap kısıtlaması kontrol |

---

## App domains (Settings → Basic)

**`localhost` yazma** — Meta kabul etmez (TLD gerekir).

| Alan | Değer |
|------|--------|
| **App domains** | `egitim.today` |
| **Privacy Policy URL** | `https://www.egitim.today` |
| **Site URL** (Facebook Login) | `https://www.egitim.today` |

Development modda **`http://localhost:3100` redirect otomatik izinlidir** — Valid OAuth Redirect URIs boş kalabilir.

### "This app needs at least one supported permission"

Business app'lerde **email + public_profile yetmez**. Çözüm:

1. Sol menü → **Facebook Login for Business** → **Configurations**
2. **Create configuration** / **Add configuration**
3. İzinler (en az biri):
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
4. Kaydet → **config_id** kopyala (sayısal ID)
5. `.env`:
   ```env
   META_LOGIN_CONFIG_ID="buraya_config_id"
   ```
6. `npm run dev` restart → OAuth tekrar

`config_id` varken kod `scope` yerine `config_id` kullanır.

---

Bu izinler geçerlidir ama **app'e eklenmeden** OAuth'ta istenemez. Content Studio varsayılan olarak yalnızca **bağlantı scope'ları** kullanır:

- `public_profile`, `email`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`

Meta → **App Review → Permissions and Features** → yukarıdakiler için **Standard Access** / Add.

Yayın scope'ları için önce Meta panelde `pages_manage_posts` + `instagram_content_publish` ekleyin, sonra `.env`:

```env
META_OAUTH_PUBLISH="true"
```

### "Domain uygulama domainlerinde yok"

1. **App domains** = `egitim.today` (localhost yazmayın)
2. **Site URL** = `https://www.egitim.today`
3. Hâlâ hata → [ngrok](https://ngrok.com) ile HTTPS tüneli ve callback'i ngrok URL'sine ayarlayın

---

Uygulama panelinde **Add products**:

1. **Facebook Login for Business** → Set up  
   - Valid OAuth Redirect URIs:
     ```
     http://localhost:3100/api/social/callback/facebook
     http://localhost:3100/api/social/callback/instagram
     ```
2. **Instagram Graph API** → Set up
3. **Pages API** (veya Marketing API — sayfa post için) → Set up

---

## 4. App ID / Secret → `.env`

**Settings → Basic:**

```env
META_APP_ID="..."
META_APP_SECRET="..."
FACEBOOK_CALLBACK_URL="http://localhost:3100/api/social/callback/facebook"
INSTAGRAM_CALLBACK_URL="http://localhost:3100/api/social/callback/instagram"
NEXT_PUBLIC_APP_URL="http://localhost:3100"
```

---

## 5. İzinler (scopes)

**Bağlantı (varsayılan):** `public_profile`, `email`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`

**Yayın (App Review sonrası):** + `pages_manage_posts`, `instagram_content_publish` → `META_OAUTH_PUBLISH=true`

**Development modda** App roles → **Administrator** (Metin Bağdat ✓) yeterli.

---

## 6. Facebook sayfasını bağlama

1. https://business.facebook.com/ → **Business Settings**
2. **Accounts → Pages** → egitim.today sayfasını ekleyin
3. **Accounts → Instagram accounts** → IG hesabını sayfaya bağlayın
4. Developer app → **App Review → Permissions** — Development modda test yeterli

---

## 7. Content Studio'da

1. `npm run dev` restart (scope değişikliği için)
2. `/admin/social` → Facebook / Instagram → **OAuth bağla**
3. Sayfa + IG hesabı seçimi

---

## Sık sorular

**Telefon kodu gelmiyor**  
Meta Developer phone verification bilinen sorun. Voice call, farklı numara veya 24–48 saat bekleyin. IG bağlantısı için bazen sadece Facebook Login yeterli olur; IG ayrı telefon doğrulama isteyebilir.

**Instagram "Professional account required"**  
IG → Ayarlar → Hesap türü → **Business** veya **Creator** → Facebook sayfasına bağla.

**App Review gerekli mi?**  
Development + kendi hesabınız test user ise **hayır**. Başkalarının hesapları için **App Review** + **Live mode** gerekir.

---

## Kontrol listesi

- [ ] developers.facebook.com developer hesabı doğrulandı
- [ ] Business type app oluşturuldu
- [ ] Facebook Login + Instagram Graph API eklendi
- [ ] Callback URL'ler localhost:3100
- [ ] META_APP_ID / META_APP_SECRET `.env`'de
- [ ] Facebook sayfası + IG Business bağlı
- [ ] App roles'da kendi FB hesabınız Admin/Test user

Tamamlayınca `.env` değerlerini kaydedip `npm run dev` yeniden başlatın — Meta OAuth entegrasyonu bir sonraki kod adımında `/admin/social`'a bağlanacak.
