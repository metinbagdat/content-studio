## Meta
- **ID:** CS-WP-01
- **Repo:** content-studio
- **Sprint:** 2
- **GitHub:** #34

## Summary
WordPress (`wp-seo-hub`) REST’e **yalnızca draft** gönderen publisher servisi.

## Scope
- [x] `lib/wordpress/publisher.ts` (env: `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`, `CONNECT_STUDIO_API_KEY`)
- [x] Endpoint tercihi: `POST /wp-json/egitimtoday/v1/publish` (CPT yönlendirmeli)
- [x] Payload: title, content, excerpt, post_type, meta, acf/HKMT
- [x] Admin: manuel “WP draft gönder” (`/admin/review` + `POST /api/wordpress`)
- [x] Asla `status: publish` gönderme
- [ ] Live smoke: WP host + plugin + DNS hazır olduktan sonra

## Depends
- wp-seo-hub Sprint 1 hosting + API key
