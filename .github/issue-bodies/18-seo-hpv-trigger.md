## Meta
- **ID:** CS-WP-03
- **Repo:** content-studio
- **Sprint:** 2

## Summary
HPV / search-volume ile konu önceliklendirme (Soro.ai veya DataForSEO/Semrush fallback).

## Scope
- [ ] `lib/seo/keywordOpportunity.ts` + env stubs
- [ ] Filtre: HPV≥75 ve volume≥500 → WP adayı; düşük → yalnız SM
- [ ] Günlük cron (local worker; prod Hobby’de kapalı kalabilir)
- [ ] Fallback keyword listesi API yoksa
