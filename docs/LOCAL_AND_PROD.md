# Yerel + Prod paralel çalışma (öncelik: local)

Aynı kod tabanı, **aynı veritabanı**, **farklı URL** ile local ve `studio.egitim.today` birlikte çalışır.

## Env nerede?

| Ortam | Dosya / yer | Kim okur |
|-------|-------------|----------|
| **Yerel (öncelik)** | `.env.local` + `.env` | `npm run dev`, `npm run worker`, Prisma |
| **Prod** | Vercel → Project → **Settings → Environment Variables** | Deploy edilen Next.js + cron |

Evet — **Vercel env = Environment Variables**. Production ortamına ekleyin; redeploy gerekir.

## Paralel mimari

```
┌─────────────────────┐     ┌──────────────────────────┐
│ localhost:3100      │     │ studio.egitim.today      │
│ NEXT_PUBLIC_APP_URL │     │ NEXT_PUBLIC_APP_URL=prod │
│ .env.local          │     │ Vercel env variables     │
└─────────┬───────────┘     └────────────┬─────────────┘
          │                              │
          └──────────┬───────────────────┘
                     ▼
            Aynı DATABASE_URL (Supabase)
            → taslak, OAuth, yayın paylaşılır
```

## Yerel kurulum (öncelik)

1. `.env.example` → `.env.local` kopyala, secret'ları doldur
2. `NEXT_PUBLIC_APP_URL=http://localhost:3100`
3. Terminal 1: `npm run dev`
4. Terminal 2: `npm run worker` (zamanlanmış yayın için)
5. `/admin/social` → OAuth env satırları yeşil olmalı

```powershell
npm run env:parity   # DB fingerprint — isteğe bağlı banner doğrulama
```

## Vercel (prod) — aynı secret'lar, farklı URL

Vercel → **Environment Variables** → **Production**:

| Değişken | Local | Prod |
|----------|-------|------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3100` | `https://studio.egitim.today` |
| `DATABASE_URL` | aynı Supabase URL | **aynı** |
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

OAuth'u **local'de önce** bağlayın; aynı DB'de prod da görür.

## Platform bazlı local kısıtlar

| Platform | Local | Not |
|----------|-------|-----|
| LinkedIn | ✅ | Görsel buffer upload |
| Facebook | ✅ | Binary upload |
| YouTube | ✅ | Video dosyadan |
| TikTok | ✅ | localhost redirect kayıtlıysa |
| X | ⚠️ | API tier / 403 — env'den bağımsız |
| Instagram | ⚠️ | Meta localhost görsel URL'sine erişemez → prod'dan yayınla veya ngrok |

Medya URL'leri (`/api/media/...`) üretildiği ortamın `NEXT_PUBLIC_APP_URL`'ini kullanır. IG prod yayını için prod'da görsel/klip üretin.

## Modül kontrol listesi

- [ ] Discovery / Pipeline / Review — DB + LLM key
- [ ] Podcast TTS — `TTS_PROVIDER=edge` (key gerekmez)
- [ ] Video / klip — ffmpeg (local'de `ffmpeg-static` paket içi)
- [ ] Sosyal OAuth — tüm platform env + portal callback
- [ ] Worker — local terminal açık
- [ ] Prod deploy — `main` merge → GitHub Actions → Vercel

Detay: [OAUTH_CALLBACKS_PRODUCTION.md](./OAUTH_CALLBACKS_PRODUCTION.md), [TIKTOK_SETUP.md](./TIKTOK_SETUP.md)
