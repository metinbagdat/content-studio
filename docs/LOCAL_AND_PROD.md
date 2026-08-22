# Yerel + Prod — hedef mimari

**Tek kaynak (onay / Arı / sosyal durum):** Supabase.  
**Günlük browse / egress güvenliği:** yerel Docker Postgres (`localhost:5434`).  
**Ağır üretim (video, uzun toplu medya):** yerel Next/worker → mümkünse **aynı Supabase** job’ına tick.

```
                    ┌─────────────────┐
                    │  Supabase (tek) │
                    │  onay · Arı ·   │
                    │  ReviewBulkJob  │
                    └────────┬────────┘
               ┌─────────────┴─────────────┐
     studio.egitim.today            localhost:3100
     (incele, OAuth, yayın)         (ffmpeg / uzun tick)
```

| Ne | Nerede |
|----|--------|
| Canlı onay kuyruğu | Supabase (prod) |
| Scratch / deneme | Docker `:5434` |
| Toplu onay ilerlemesi (75/127) | `ReviewBulkJob` tablosu — sekme/makine bağımsız |
| Video üretimi | Yerel (Vercel serverless’ta atlanır → Arı) |

**Egress:** Sürekli `DATABASE_URL=Supabase` ile `npm run dev` Hobby kotasını yer. Günlük UI için Docker; prod kuyruğunu yerelden işlemek için kısa session (Supabase URL + bitince Docker’a dön). Worker: `CS_ALLOW_SUPABASE_WORKER=1` yalnız one-shot.

## Env nerede?

| Ortam | Dosya / yer | Kim okur |
|-------|-------------|----------|
| **Yerel (öncelik)** | `.env.local` + `.env` | `npm run dev`, `npm run worker`, Prisma |
| **Prod** | Vercel → Project → **Settings → Environment Variables** | Deploy edilen Next.js + cron |

Evet — **Vercel env = Environment Variables**. Production ortamına ekleyin; redeploy gerekir.

## Paralel UI (eski varsayılan — scratch)

```
┌─────────────────────┐     ┌──────────────────────────┐
│ localhost:3100      │     │ studio.egitim.today      │
│ Docker Postgres     │     │ Vercel + Supabase        │
│ :5434 (scratch)     │     │ (canlı kuyruk)           │
└─────────────────────┘     └──────────────────────────┘
```

Scratch Docker ve prod **ayrı veri** — Onay 220 ≠ 423 normal. Canlı kuyruk için prod UI veya yerelde geçici Supabase URL.

Aynı Supabase URL’yi sürekli local + prod paylaşmak **Hobby egress kotasını yer**. Günlük browse için Docker kullan.

## ReviewBulkJob (75/127)

`POST /api/review/bulk-job` — `create` → döngüde `tick` → `pause` / `cancel` / `resume`.  
İlerleme DB’de; prod’da 75’te kalıp yerelde aynı Supabase’e bağlanınca devam edilebilir.

## Yerel kurulum (öncelik)

`DATABASE_URL` `localhost:5434` ise **`npm run dev` Docker Postgres’i açar** (`predev`), drain worker’ı bir kez çalıştırır (kuyruk bitince **çıkar**), Next `:3100` açık kalır. 15 saniyelik sonsuz worker için `npm run worker:loop` — günlük işte kullanma.

1. `.env` + `.env.local`: `DATABASE_URL=postgresql://content:content@localhost:5434/content_studio?schema=public`
2. `NEXT_PUBLIC_APP_URL=http://localhost:3100`
3. Terminal: `npm run dev` — worker’ı yalnızca yayın varken aç
4. `/admin/social` → OAuth env satırları yeşil olmalı

Elle: `npm run db:up`  ·  atla: `SKIP_LOCAL_DOCKER=true`

```powershell
npm run env:parity   # DB fingerprint — isteğe bağlı banner doğrulama
```

## Vercel (prod) — aynı secret'lar, farklı URL

Vercel → **Environment Variables** → **Production**:

| Değişken | Local | Prod |
|----------|-------|------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3100` | `https://studio.egitim.today` |
| `DATABASE_URL` | `localhost:5434` (Docker) | Supabase session pooler |
| `TOKEN_ENCRYPTION_KEY` | aynı (32+ char) | **aynı** (OAuth token decrypt) |
| `X_CLIENT_ID` / `SECRET` | aynı | aynı |
| `LINKEDIN_*` | aynı | aynı |
| `YOUTUBE_*` | aynı | aynı |
| `META_APP_ID` / `SECRET` | aynı | aynı |
| `TIKTOK_CLIENT_KEY` / `SECRET` | aynı | aynı |
| `GROQ_API_KEY` / `OPENAI_*` | aynı | aynı |
| `ADMIN_API_KEY` | istediğiniz | prod için güçlü secret |
| `DEPLOY_PARITY_DB_FINGERPRINT` | opsiyonel | opsiyonel |

Callback URL'ler ortama göre override edilebilir (`*_CALLBACK_URL`) — yoksa `NEXT_PUBLIC_APP_URL` + `/api/social/callback/...` otomatik türetilir.

## OAuth — her portalda İKİ redirect URI

Local ve prod **aynı OAuth uygulamasını** kullanabilir; developer portalda **her iki callback** kayıtlı olmalı:

| Platform | Local | Prod |
|----------|-------|------|
| X | `http://localhost:3100/api/social/callback/twitter` | `https://studio.egitim.today/...` |
| LinkedIn | `http://localhost:3100/.../linkedin` | `https://studio.egitim.today/...` |
| YouTube | `http://localhost:3100/.../youtube` | `https://studio.egitim.today/...` |
| Meta FB/IG | `http://localhost:3100/.../facebook` | `https://studio.egitim.today/...` |
| TikTok | `http://localhost:3100/.../tiktok` | `https://studio.egitim.today/...` |

OAuth’u prod DB’de bağlamak için geçici olarak Supabase URL kullanın, sonra local Docker’a dönün. Aksi halde local ve prod hesapları ayrılır.

## Platform bazlı local kısıtlar

Local Docker ve prod **ayrı veritabanı**. Prod’da bağlı hesap local’de görünmez.

| Platform | Local OAuth | Not |
|----------|-------------|-----|
| X | ✅ | Localhost callback |
| YouTube | ✅ | Localhost callback; MP4 dosyadan |
| TikTok | ✅ | Login Kit **Desktop/PKCE** + localhost |
| LinkedIn | ⚠️ kişisel | `LINKEDIN_ORG_POST=false`. Şirket sayfası (`w_organization_social`) local’de `unauthorized_scope_error` |
| Facebook | ❌ prod | Meta Login for Business localhost http kaydetmez. `studio.egitim.today` |
| Instagram | ❌ prod | Aynı Meta kısıtı + localhost görsel URL’sine erişemez |

Medya URL'leri (`/api/media/...`) üretildiği ortamın `NEXT_PUBLIC_APP_URL`'ini kullanır. IG prod yayını için prod'da görsel/klip üretin.

## Modül kontrol listesi

- [ ] Discovery / Pipeline / Review — DB + LLM key
- [ ] Podcast TTS — `TTS_PROVIDER=edge` (key gerekmez)
- [x] Video / klip — ffmpeg (local'de `ffmpeg-static` paket içi; Shorts + long YouTube upload doğrulandı)
- [ ] Sosyal OAuth — tüm platform env + portal callback
- [ ] Worker — local terminal açık
- [ ] Prod deploy — `main` merge → GitHub Actions → Vercel

Detay: [OAUTH_CALLBACKS_PRODUCTION.md](./OAUTH_CALLBACKS_PRODUCTION.md), [TIKTOK_SETUP.md](./TIKTOK_SETUP.md)

## Local-first üretim (Supabase kota)

**Egress = Supabase’ten çıkan trafik.** `npm run dev` / `npm run worker` `DATABASE_URL` Supabase ise her Prisma sorgusu (admin sayfası, 15s worker tick, analytics) Hobby 5 GB kotasına yazılır. Disk/MAU değil — senin 15 GB bu.

**14 Aug 2026 sonrası 402 olmaması için:**

1. Local Postgres: `docker compose up -d postgres`
2. `.env` + `.env.local`:
   `DATABASE_URL=postgresql://content:content@localhost:5434/content_studio?schema=public`
3. `npx prisma db push` (veya `npx prisma migrate deploy`)
4. Worker’ı yalnızca yayın yaparken aç; sürekli açık tutma (özellikle eski `full` 15s tick)
5. Prod Vercel’de kalsın: `SOCIAL_AUTOPILOT=false`, `DISCOVERY_CRON_ENABLED=false`, `ANALYTICS_SYNC_ENABLED=false`

OAuth token / taslakları bir kez kopyalamak istersen (tek seferlik egress):

```powershell
# pg_dump + psql — şifre .env’deki Supabase URL’den
```

**`CS_ALLOW_SUPABASE_WORKER=1` günlük Docker işinde yok.** Yalnızca kısa prod-DB komutu (migrate / re-atomize); bitince kaldır.

Medya dosyaları **Supabase Storage'a gitmez** — `storage/images`, `storage/videos`, `storage/audio` yerel diskte kalır.

Kota uyarısı org düzeyinde (disk, egress, bağlantı). Prod'da ağır işleri kapatın, üretim + yayını local Docker’dan yapın:

| Ortam | Rol |
|-------|-----|
| **Local** (`npm run dev`) | Docker + Next + drain worker (iş bitince kapanır). Video/yayın kuyruğu. |
| **Prod** (`studio.egitim.today`) | Supabase + Vercel. Autopilot / discovery / cron **kapalı**. 15s worker yok. |

**Vercel Production env (kota için zorunlu):**

```env
SOCIAL_AUTOPILOT=false
SOCIAL_AUTO_PUBLISH=false
DISCOVERY_CRON_ENABLED=false
ANALYTICS_SYNC_ENABLED=false
```

`vercel.json` → `crons: []` (Hobby günlük cron kapalı). Discovery / analytics yalnızca local worker’da, bayraklar `true` iken.

Günlük cron route (`/api/cron/daily`) hâlâ kodda; yeniden açmak için `vercel.json`’a schedule ekle + yukarıdaki bayrakları bilinçli aç.

**Local akış:**

1. `.env.local` → `NEXT_PUBLIC_APP_URL=http://localhost:3100`
2. Terminal 1: `npm run dev` — Terminal 2: `npm run worker`
3. `/admin/social` → görsel/klip/video üret → **Şimdi yayınla**
4. Facebook 403 → `.env.local`: `META_OAUTH_PUBLISH=true`, `META_LOGIN_CONFIG_ID_PUBLISH=919581157862599` → Facebook **Kes** → **OAuth bağla**
5. YouTube ffprobe hatası → dev sunucuyu yeniden başlatın (`npm run dev:clean`)

**Prod admin paneli:** Vercel'deki `ADMIN_API_KEY` ile giriş — `admin123` prod'da çalışmaz.
