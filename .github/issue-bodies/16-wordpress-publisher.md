## Meta
- **ID:** CS-WP-01
- **Repo:** content-studio
- **Sprint:** 2

## Summary
WordPress (`wp-seo-hub`) REST’e **yalnızca draft** gönderen publisher servisi.

## Scope
- [ ] `lib/wordpress/publisher.ts` (env: `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`, `CONNECT_STUDIO_API_KEY`)
- [ ] Endpoint tercihi: `POST /wp-json/egitimtoday/v1/publish` (CPT yönlendirmeli)
- [ ] Payload: title, content, excerpt, post_type, meta, acf/HKMT
- [ ] Admin: manuel “WP’ye draft gönder” veya pipeline sonrası kuyruk
- [ ] Asla `status: publish` gönderme

## Depends
- wp-seo-hub Sprint 1 hosting + API key
