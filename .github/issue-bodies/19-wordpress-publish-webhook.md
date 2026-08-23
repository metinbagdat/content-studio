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
- [x] Smoke script: `npm run wp:webhook-smoke` (needs `WP_PUBLISH_WEBHOOK_SECRET` or `CONNECT_STUDIO_API_KEY` on prod)
- [ ] Live smoke after wp-seo-hub publish hook fires (end-to-end from real WP publish)
