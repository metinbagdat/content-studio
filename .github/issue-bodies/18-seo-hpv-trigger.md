## Meta
- **ID:** CS-WP-03
- **Repo:** content-studio
- **Sprint:** 2
- **GitHub:** #36

## Summary
HPV / search-volume ile konu önceliklendirme (Soro.ai veya DataForSEO/Semrush fallback).

## Scope
- [x] `lib/seo/keywordOpportunity.ts` + env stubs (`SEO_API_KEY`, `SEO_API_BASE_URL`)
- [x] Filtre: HPV≥75 ve volume≥500 → WP adayı; düşük → yalnız SM
- [x] Günlük cron (local worker `daily`/`full`; `HPV_CRON_ENABLED`)
- [x] Fallback keyword listesi API yoksa
- [ ] Live SEO API (Soro / DataForSEO) when key is available
- [ ] Live WP smoke after host is up
