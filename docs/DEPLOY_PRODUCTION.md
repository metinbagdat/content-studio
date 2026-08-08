# Content Studio — Production deploy (`studio.egitim.today`)

Senaryo A: **$0/ay** — Vercel Hobby web + günde 1× cron + manuel butonlar. Worker process **gerekmez**.

## 1. Vercel projesi oluştur

1. [vercel.com/new](https://vercel.com/new) → Import `metinbagdat/content-studio`
2. **LearnCon projesinden ayrı** proje olmalı
3. Domain: `studio.egitim.today` (DNS CNAME → `cname.vercel-dns.com`)

## 2. Vercel Environment Variables (Production)

```env
NEXT_PUBLIC_APP_URL=https://studio.egitim.today
DATABASE_URL=postgresql://...supabase session pooler...
ADMIN_API_KEY=<güçlü-secret>
TOKEN_ENCRYPTION_KEY=<32+ karakter sabit>
CRON_SECRET=<openssl rand -hex 32>
BRAND_URL=https://www.egitim.today
BRAND_NAME=egitim.today

# OAuth — callback'ler otomatik: https://studio.egitim.today/api/social/callback/*
X_CLIENT_ID=...
X_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_ORG_POST=true
LINKEDIN_ORGANIZATION_ID=135178071
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
META_APP_ID=...
META_APP_SECRET=...
META_LOGIN_CONFIG_ID=...

GROQ_API_KEY=...
SOCIAL_AUTOPILOT=true
SOCIAL_AUTO_PUBLISH=false
DISCOVERY_DAILY_LIMIT=2
```

OAuth provider konsollarında redirect URI'leri prod URL ile güncelle (bkz. SOCIAL_ACCOUNTS_SETUP.md).

## 3. GitHub Actions deploy

Repo secrets (Settings → Secrets):

| Secret | Açıklama |
|--------|----------|
| `VERCEL_TOKEN` | Vercel → Account → Tokens |
| `CONTENT_STUDIO_VERCEL_PROJECT_ID` | Yeni projenin ID'si |
| `VERCEL_ORG_ID` | Team/personal scope (LearnCon ile aynı olabilir) |

Deploy: Actions → **Deploy Content Studio** → Run workflow  
veya `main` branch push (Git auto-deploy kapalı — yalnızca GHA).

## 4. LearnCon admin linki

LearnCon Vercel env:

```env
NEXT_PUBLIC_CONTENT_STUDIO_URL=https://studio.egitim.today/admin
```

## 5. Günlük iş akışı (Senaryo A)

| Ne zaman | Ne yapılır |
|----------|------------|
| **06:00 TR** | Vercel cron → günlük bakım (otomatik) |
| **Onay sonrası** | Takvimde zamanla veya «Şimdi yayınla» |
| **Acil zamanlanmış** | Admin → «Zamanlanmışları yayınla» |
| **Video üretimi** | Yerelde «Tam tur» veya `npm run worker` (opsiyonel) |

## 6. Kontrol listesi

- [ ] https://studio.egitim.today/admin açılıyor
- [ ] `CRON_SECRET` tanımlı → worker status «cron: aktif»
- [ ] OAuth prod callback'ler kayıtlı → `/admin/social` bağlantılar OK
- [ ] «Günlük bakım» manuel test → zamanlanmış + metrik OK
- [ ] LearnCon sidebar → Content Studio linki

## 404 DEPLOYMENT_NOT_FOUND — hızlı çözüm

DNS doğru (Vercel'e gidiyor) ama **hiç production deploy yok**. Genelde domain eklendi, proje deploy edilmedi.

### A) Vercel Dashboard (en hızlı, ~10 dk)

1. [vercel.com/new](https://vercel.com/new) → **Import** `metinbagdat/content-studio`
2. Proje adı: `content-studio` (LearnCon projesinden **ayrı**)
3. **Environment Variables** (Production) — en az:
   - `NEXT_PUBLIC_APP_URL` = `https://studio.egitim.today`
   - `DATABASE_URL` = Supabase session pooler
   - `ADMIN_API_KEY` = güçlü secret
   - `TOKEN_ENCRYPTION_KEY` = 32+ karakter
   - `CRON_SECRET` = rastgele uzun string
4. **Deploy** — ilk build bitene kadar bekle
5. Project → **Settings → Domains** → `studio.egitim.today` ekle (başka projede varsa önce oradan kaldır)
6. Settings → General → **Project ID** kopyala

### B) GitHub secrets (sonraki deploy'lar için)

`content-studio` repo → Settings → Secrets:

| Secret | Değer |
|--------|--------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `CONTENT_STUDIO_VERCEL_PROJECT_ID` | Adım 6'daki Project ID |
| `VERCEL_ORG_ID` | Team ID (Settings → General) |

Sonra: Actions → **Deploy Content Studio** → **Run workflow**

### Doğrulama

```text
https://studio.egitim.today/admin  →  admin panel (404 olmamalı)
```

## Maliyet

| Bileşen | Maliyet |
|---------|---------|
| Vercel Hobby (2. proje) | $0 |
| Supabase Free | $0 |
| Worker / Railway | $0 (kullanılmıyor) |
| X API metrikleri | ~$200/ay (opsiyonel) |
