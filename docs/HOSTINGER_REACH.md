# Hostinger Reach — e-posta pazarlama

Blog / içerik listesi için. LearnCon ders, ödeme, şifre sıfırlama mailleri **burada değil** (`learncon` LC-G4).

Reach kampanya **gönderimi API’de yok**. AI ile mail yazma + Send, Reach panelinde kalır. Content Studio yalnızca **kişileri** senkronlar.

## Hostinger’da

1. hPanel → **Reach** (e-posta pazarlama) hesabını aç.
2. Gönderen domain: `egitim.today` nameserver’ı Vercel’de. SPF/DKIM’i **Vercel DNS**’e ekle (Hostinger “otomatik auth” nameserver isterse kullanma).
3. **API token:** [hPanel → API](https://hpanel.hostinger.com/api) (Account / Bearer token).  
   Reach eklentisi **Integrations → Public API** anahtarı çoğu zaman `Unauthenticated` verir — Content Studio **Hostinger Account API** token ister.
4. WordPress (`blog.egitim.today`): eklenti **Hostinger Reach** (form / CF7 / Woo sync). Public kayıt formları WP’de; CS admin’e herkese açık subscribe koyma.

## Content Studio env

```env
HOSTINGER_API_TOKEN=""
# HOSTINGER_REACH_TOKEN=""   # alias; API_TOKEN yoksa bu okunur
HOSTINGER_REACH_PROFILE_UUID=""
```

Vercel Production + Preview’a aynı değişkenler. Token’ı git’e yazma.

## Bu repodaki uçlar

| | |
|--|--|
| Admin UI | `/admin/email` |
| Durum + liste | `GET /api/email/reach` (`x-admin-key`) |
| Kişi ekle | `POST /api/email/reach` `{ "action": "create-contact", "email": "..." }` |

Kod: `lib/email/hostingerReach.ts` → `https://developers.hostinger.com/api/reach/v1/...`

Çift opt-in Reach’te açıksa kişi `pending` olur; onay maili Reach gönderir.

**Gruplar:** `GET /api/reach/v1/contacts/groups` bazı hesaplarda `[Reach:9999]` döner. CS bunu yumuşak hata sayar — kişi listesi çalışmaya devam eder.

## Issue’lar

- CS-EM-01 API client + kişi ekle
- CS-EM-02 `/admin/email`
- CS-EM-03 WP yayın → bülten hatırlatması (kampanya send yok)
- wp-seo-hub: Reach WP eklentisi + form
