# WordPress bridge (content-studio ↔ wp-seo-hub)

Canonical SEO/blog repo: [`metinbagdat/wp-seo-hub`](https://github.com/metinbagdat/wp-seo-hub)  
Product LMS: [`metinbagdat/learncon`](https://github.com/metinbagdat/learncon)

## Env (content-studio)

```env
WP_BASE_URL=https://blog.egitim.today
WP_USERNAME=
WP_APP_PASSWORD=
CONNECT_STUDIO_API_KEY=
SAFE_SAMURAI_ENABLED=true
HPV_GATE_ENABLED=true
HPV_CRON_ENABLED=true
HPV_DAILY_LIMIT=8
SEO_API_KEY=
SEO_API_BASE_URL=
```

## Implemented

| Piece | Path | Issue |
|-------|------|-------|
| Safe samurAI gate | `lib/wordpress/safeSamurai.ts` | #35 |
| Draft publisher | `lib/wordpress/publisher.ts` | #34 |
| Derived → validate → send | `lib/wordpress/sendDraft.ts` | #34/#35 |
| HPV / SEO topic trigger | `lib/seo/keywordOpportunity.ts` | #36 |
| WP publish webhook → SM | `POST /api/webhooks/wordpress-published` | #37 |
| Admin API | `POST /api/wordpress` | #34–#36 |

### Admin API (`x-admin-key`)

```http
GET  /api/wordpress
POST /api/wordpress
  { "action": "send-derived", "derivedId": "..." }
  { "action": "validate-only", "derivedId": "..." }
  { "action": "send-payload", "payload": { ... } }
  { "action": "score-topic", "title": "..." }
  { "action": "hpv-scan", "limit": 8 }
```

Always **draft** via `POST /wp-json/egitimtoday/v1/publish` + `X-API-Key`.

HPV gate: HPV ≥ 75 **and** search volume ≥ 500 → WP adayı; aksi halde yalnız SM. API yoksa `FALLBACK_KEYWORDS` kullanılır. `HPV_GATE_ENABLED=false` ile atlanır.

### Publish webhook (WordPress → Content Studio)

```http
POST /api/webhooks/wordpress-published
X-API-Key: $CONNECT_STUDIO_API_KEY

{
  "post_id": 123,
  "title": "...",
  "link": "https://blog.egitim.today/...",
  "post_type": "article",
  "content": "<p>...</p>"
}
```

Idempotent on `post_id` (`wp-post:{id}` tag). Creates a `ContentSource` and queues the existing SM pipeline.

## Order of work

1. wp-seo-hub hosting + plugins (Sprint 1) — Oracle A1 / Hostinger
2. ~~CS-WP-01 publisher + CS-WP-02 Safe samurAI~~
3. ~~CS-WP-03 HPV trigger~~ (code; live SEO API optional)
4. ~~CS-WP-04 publish webhook → SM~~ (code; live WP smoke after host)
