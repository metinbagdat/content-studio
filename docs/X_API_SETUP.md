# X (Twitter) API — 403 Forbidden düzeltme

Hata: `Your account is not permitted to access this feature` (403)

Bu **kod hatası değil** — X Developer hesabının **yazma (tweet) planı** yok.

## Adımlar

1. [developer.x.com](https://developer.x.com) → **Projects & Apps** → uygulamanız
2. **Products** → **X API** → **Basic** ($100/ay) veya **Pay-per-use** abone olun  
   (Ücretsiz tier çoğu hesapta `POST /2/tweets` **kapalı**)
3. **User authentication settings** → **Set up** / **Edit**:
   - App permissions: **Read and write**
   - Type of App: **Web App**
   - Callback: `https://studio.egitim.today/api/social/callback/twitter`
   - Website: `https://www.egitim.today`
4. **Keys and tokens** — OAuth 2.0 Client ID / Secret Vercel env'de (`X_CLIENT_ID`, `X_CLIENT_SECRET`)
5. Content Studio → Sosyal → X → **Kes** → **OAuth bağla** (yeni scope'lar için)
6. Test: `npx tsx scripts/diagnose-x-api.ts`

## Env

```env
X_CLIENT_ID=...
X_CLIENT_SECRET=...
X_CALLBACK_URL=https://studio.egitim.today/api/social/callback/twitter
```

## Otomasyon

Workflow X'i **403 nedeniyle atlar** (`SKIP_AUTO_PUBLISH`). Plan aktif olunca `lib/workflow/runContinueStep.ts` içinden TWITTER'ı listeden çıkarın veya portal düzelince otomatik denenebilir.

## İstatistikler vs yayın

Basic plan **tweet yazmayı** açar. Takipçi/gösterim API uçları ayrı ücretli olabilir — yayın (`tweet.write`) ile karıştırmayın.
