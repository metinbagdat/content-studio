# Meta App Review — `pages_manage_posts` (yapıştır + yükle)

App: **www.egitim.today** (`1309132857965857`)  
Business: **Egitim.today / learnconnect.net** — durum **In review** (yeterli; Remove etme)  
Sayfa: **Egitim.today** (`1153725161168373`)

## İki ayrı Meta ekranı (karıştırmayın)

| Ekran | Menü | Ne iş |
|-------|------|--------|
| **App Review** (şimdi) | Review → **Uygulama İncelemesi** | `pages_manage_posts` Submit |
| **Data access renewal** | üstteki **Required actions** | **7 Eki 2026** — App Review’dan ayrı; kaçırma |

Admin `/admin/social` üstte kalan gün sayısını gösterir. Toplu Facebook varsayılan 8 post/tur (spam 400).

Reviewer instructions sizi **App settings → Temel**’e atarsa: Privacy/ToS hâlâ `facebook.com`. Önce URL’leri düzeltin, sonra checklist’e dönün.

### App settings → Temel (kaydet)

| Alan | Değer |
|------|--------|
| Privacy Policy URL | `https://studio.egitim.today/legal/privacy` |
| Terms of Service URL | `https://studio.egitim.today/legal/terms` |
| User data deletion URL | `https://studio.egitim.today/legal/privacy#veri-silme` |

`facebook.com/privacy` ve `facebook.com` **kullanmayın** — review reddi.

Sonra: **Review → Uygulama İncelemesi** → **Go to verification** (wizard içinde kalın; Temel sayfasına tekrar gitmeyin).

## Nereye yüklenir?

Developers → **Review** → **Uygulama İncelemesi** → submission wizard:

1. Verification (portfolio bağlı) → **Next**
2. App settings → **Next**
3. Allowed usage → `pages_manage_posts` → **Next**
4. Data handling → **Next**
5. **Reviewer instructions** ← burası
   - Metin kutusuna aşağıdaki **English** bloğu yapıştır
   - **Upload screencast / video** → **gerçek ekran kaydı** MP4 (2–4 dk)  
     Storyboard: `docs/META_APP_REVIEW_RECORDING.md` (adım sırası)  
     **Göndermeyin:** `generate-meta-app-review-video.ts` çıktısı (SVG mock OAuth — red riski)
6. Checklist 1–5 yeşil → **Submit for review**

Sadece **`pages_manage_posts`** isteyin. Messaging / comments / WhatsApp / ads eklemeyin.

---

## Test hesabı / login (reviewer)

| Ne | Değer |
|----|--------|
| App | https://studio.egitim.today/admin/social |
| Facebook kullanıcısı | **Metin Bağdat** (App Administrator, Full control) |
| Facebook Sayfası | **Egitim.today** (Page ID `1153725161168373`) |
| Content Studio kapısı | Header **Admin API key** = Vercel Production `ADMIN_API_KEY` (local `admin123` prod’da çalışmaz) |
| OAuth | Facebook kartı → **OAuth bağla** → Login Config `919581157862599` (`pages_manage_posts`) |

Reviewer’a şifre vermeyin. Meta kendi Facebook oturumu + sizin admin hesabınızla test eder; gerekirse **App roles → Testers** ile reviewer e-postasını ekleyin.

---

## Yapıştır: Reviewer instructions (English)

```text
App: www.egitim.today (Content Studio)
Production URL: https://studio.egitim.today/admin/social
Facebook Page: Egitim.today (ID 1153725161168373)
Facebook Login user: Metin Bağdat (App Administrator)
Login configuration ID: 919581157862599 (includes pages_manage_posts)

How to sign in to the app:
1. Open https://studio.egitim.today/admin/social
2. In “Admin API key”, paste the production ADMIN_API_KEY (shared with Meta reviewer via App Review notes / secure note — not public).
3. Click Yenile (Refresh). The Social dashboard loads.

How to grant pages_manage_posts:
1. On the Facebook card, click “Kes” if an old token exists, then “OAuth bağla”.
2. Complete Facebook Login for Business.
3. Grant pages_manage_posts (and Page access for Egitim.today).
4. You return to the dashboard; Facebook shows “Bağlı”.

How to publish (this is why we need pages_manage_posts):
1. Under Facebook, open a DRAFT (or click “Yayınla” on a ready draft).
2. Confirm publish. Content Studio calls the Pages API to create a Page post (text + optional image).
3. Status becomes PUBLISHED. Open the Egitim.today Facebook Page feed to see the post.

What we do NOT do:
- We do not post to Pages the user does not manage.
- We do not use this permission for ads, WhatsApp, Instagram comments, or messaging.
- Publish is an explicit admin click, not silent scraping.

Screencast: attached MP4 walkthrough of the same steps.
```

## Yapıştır: Allowed usage / permission description

```text
Content Studio is an internal publishing tool for the egitim.today Facebook Page.
An administrator signs in, connects the Page with Facebook Login for Business, then
clicks Publish in the admin UI. We use pages_manage_posts only to create or update
posts on Pages the user administers (text and optional image/video) via the Pages API.
```

---

## Gerçek ekran kaydı (Meta zorunlu — mock değil)

SVG/ffmpeg storyboard (`generate-meta-app-review-video.ts`) **App Review'a yüklenmez**. Özellikle OAuth adımı gerçek `facebook.com/.../dialog/oauth` olmalı; reviewer kendi hesabıyla tekrar edebilmeli.

Tam storyboard + checklist: **`docs/META_APP_REVIEW_RECORDING.md`**

Windows hızlı kayıt:

1. `Win + G` → Capture → **Record**
2. `https://studio.egitim.today/admin/social` (prod ADMIN_API_KEY)
3. OAuth bağla → **gerçek** Facebook izin ekranı → Yayınla → facebook.com/Egitim.today post
4. 2–4 dk MP4 → Reviewer instructions upload

Spam limiti varsa tek **Yayınla** (toplu değil). IG / başka izinler **ayrı video** — bkz. aşağı `instagram_content_publish`.

---

## Yapıştır: Reviewer instructions — `instagram_content_publish` (Video 2, ayrı submission)

```text
App: www.egitim.today (Content Studio)
Production URL: https://studio.egitim.today/admin/social
Instagram Business: @egitim.today (linked to Facebook Page Egitim.today)
Facebook Login user: Metin Bağdat (App Administrator)
Login configuration ID: 919581157862599 (includes instagram_content_publish)

How to sign in:
1. Open https://studio.egitim.today/admin/social
2. Paste production ADMIN_API_KEY → Yenile.

How to grant instagram_content_publish:
1. On the Instagram card, click Kes if needed, then OAuth bağla.
2. Complete Facebook Login for Business — grant instagram_content_publish for the IG Business account.
3. Return to dashboard; Instagram shows Bağlı.

How we use instagram_content_publish:
1. Under Instagram, open a DRAFT with a public HTTPS image URL.
2. Click Yayınla. Content Studio publishes via the Instagram Content Publishing API.
3. Open https://www.instagram.com/egitim.today/ to see the post.

We do not post to accounts the user does not manage. Publish is an explicit admin click.

Screencast: attached MP4 (Instagram publish only — no Facebook Page publish in this video).
```

## Yapıştır: Allowed usage — `instagram_content_publish`

```text
Content Studio publishes pre-approved educational images to our own Instagram Business account
(@egitim.today). An administrator connects the account via Facebook Login for Business, then
clicks Publish. We use instagram_content_publish only for content the admin owns and approves.
```
