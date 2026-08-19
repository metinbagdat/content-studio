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
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
# GSC_SITE_URL=https://blog.egitim.today/
# GSC_ACCESS_TOKEN=
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

## Decision: no Soro autopilot

[Soro](https://trysoro.com) writes **and publishes** daily to WordPress. That bypasses Safe samurAI, fights Content Studio for the same URLs, and is not a HPV/volume API (`SEO_API_KEY` expects `/keywords?q=`).

Use: Rank Math + GSC now; DataForSEO later if we need keyword metrics. Soro only if ever as **Draft** in its dashboard — never auto-publish.

## Order of work (marketing)

1. ~~Hosting + plugins + DNS `blog.egitim.today`~~
2. ~~Real homepage (TT4, not Études/Hostinger AI demo); CTA → `egitim.today`~~
3. **Now — Rank Math wizard + Google Search Console** (`blog.egitim.today`). Core sitemap: `/wp-sitemap.xml` until Rank Math finishes setup.
4. **Now — Samurai-publish** first drafts (WP `#15` + 2–4 more via `/admin/review`).
5. **Then — HPV live API** = DataForSEO (`DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD`); GSC overlay optional. Not Soro.
6. **LearnCon `/blog`:** long-form **migrates to WP**; leftover `/blog` is product news. 301s live in `metinbagdat/learncon` (CS-WP-05). Do not keep duplicate articles on both hosts.
7. **Then — LearnCon LC-G6** pillar pages (not this repo).
8. **Then — CS-WP-04** webhook live smoke.
9. **Later — Hostinger Reach** after there are posts to mail.
