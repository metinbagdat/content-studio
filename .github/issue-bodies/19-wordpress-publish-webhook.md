## Meta
- **ID:** CS-WP-04
- **Repo:** content-studio
- **Sprint:** 4
- **GitHub:** #37

## Summary
WordPress publish webhook alıcısı → mevcut SM atomizasyon / schedule akışına bağla.

## Scope
- [x] `POST /api/webhooks/wordpress-published` (`X-API-Key` = `CONNECT_STUDIO_API_KEY`)
- [x] Payload → `ContentSource` + `createPipeline` (mevcut SM akışı)
- [x] Idempotency by `post_id` (`wp-post:{id}` tag)
- [x] Docs: `docs/WORDPRESS_BRIDGE.md`
- [ ] Live smoke after wp-seo-hub publish hook fires
