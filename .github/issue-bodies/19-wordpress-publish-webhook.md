## Meta
- **ID:** CS-WP-04
- **Repo:** content-studio
- **Sprint:** 4

## Summary
WordPress publish webhook alıcısı → mevcut SM atomizasyon / schedule akışına bağla.

## Scope
- [ ] `POST /api/webhooks/wordpress-published` (`X-API-Key`)
- [ ] Payload → caption/draft üretimi (mevcut pipeline’a bağla; Buffer zorunlu değil)
- [ ] Idempotency by `post_id`
- [ ] Docs: `docs/WORDPRESS_BRIDGE.md`
