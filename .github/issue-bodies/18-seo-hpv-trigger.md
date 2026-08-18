## Meta
- **ID:** CS-WP-03
- **Repo:** content-studio
- **Sprint:** 2
- **GitHub:** #36

## Summary
HPV / search-volume ile konu önceliklendirme (GSC + optional DataForSEO). **Not Soro** — Soro is an autopublish writer, not a keyword API.

## Scope
- [x] `lib/seo/keywordOpportunity.ts` + env stubs (`SEO_API_KEY`, `SEO_API_BASE_URL`)
- [x] Filtre: HPV≥75 ve volume≥500 → WP adayı; düşük → yalnız SM
- [x] Günlük cron (local worker `daily`/`full`; `HPV_CRON_ENABLED`)
- [x] Fallback keyword listesi API yoksa
- [x] `lib/seo/dataForSeo.ts` — Google Ads search volume (TR) via `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`
- [x] Optional GSC overlay (`GSC_SITE_URL` + `GSC_ACCESS_TOKEN`)
- [ ] Put live DataForSEO credentials in Vercel + local `.env` (no Soro)
- [ ] Live WP: HPV-picked topic → draft on `blog.egitim.today`
