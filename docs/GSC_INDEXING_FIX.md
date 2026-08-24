# GSC Page indexing — blog.egitim.today (2026-08-24)

## What we found

| GSC reason | Count | Likely URL / cause | Fix |
|------------|------:|--------------------|-----|
| Not found (404) | 2 | `/sample-page/`, `/hello-world/` (WP defaults, deleted then crawled) | Recreated as **noindex** stubs + Rank Math redirect records; plugin `gsc-soft404-redirects.php` does **301 → /** when deployed |
| Excluded by noindex | 1 | Usually **author** archive (`/author/...` → `follow, noindex`) or sitemap XML (`X-Robots-Tag: noindex`, normal for Rank Math) | **Leave.** Thin author archives should stay noindex |
| Blocked by robots.txt | 1 | `/wp-admin/` (robots.txt `Disallow: /wp-admin/`) | **Leave.** Correct; do not allow admin |
| Crawled – not indexed | 5 | Soft Google quality / crawl budget | Strengthen: URL Inspection on top posts; wait; strengthen internal links |
| Discovered – not indexed | 1 | Same | URL Inspection + sitemap already submitted |

## Already healthy

- Home + articles: `robots: index, follow`
- `robots.txt` points at `sitemap_index.xml`
- Sitemap 200 (Rank Math); post list includes live articles incl. karar-verme hub
- New article: `https://blog.egitim.today/karar-verme-hedef-belirleme-esenlik-dongusu/`

## Ops checklist (you in GSC + WP)

1. **LiteSpeed** → purge all (redirect/noindex pages may be cached).
2. Upload plugin zip `egitim-today-cpt` **1.1.1** (includes soft-404 301s) *or* Rank Math → Redirections → Add:
   - `sample-page` → `https://blog.egitim.today/` (301)
   - `hello-world` → `https://blog.egitim.today/` (301)
3. GSC → **Pages** → each reason → **Validate fix** (starts Google recheck; takes days).
4. GSC → URL Inspection → inspect + “Request indexing” for:
   - `https://blog.egitim.today/`
   - `https://blog.egitim.today/karar-verme-hedef-belirleme-esenlik-dongusu/`
   - one older pillar (e.g. `zamani-zafere-donusturmek`)
5. GSC → Sitemaps → confirm `sitemap_index.xml` Success (not “Couldn’t fetch”).

## Script

```powershell
npm run gsc:fix-404
# or: npx tsx --env-file=.env scripts/fix-gsc-404-redirects.mjs
```

Creates/updates the stub pages + Rank Math meta (noindex) if missing.
