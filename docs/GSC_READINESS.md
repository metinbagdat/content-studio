# GSC Readiness — Go/No-Go for CS-WP-03b OAuth

**Property:** `https://blog.egitim.today/`  
**Last automated check:** 2026-08-20  
**Gate:** Start **CS-WP-03b** only when **Impressions > 0** + **Queries non-empty** + **48h stable** (manual GSC UI).

---

## Checklist

| # | Check | How | Status (2026-08-20) |
|---|--------|-----|---------------------|
| 1 | Property correct | GSC → property picker | **Manual** — confirm `https://blog.egitim.today/` |
| 2 | Sitemap submitted | GSC → Sitemaps | **Manual** — submit `sitemap_index.xml` if not done |
| 3 | Sitemap live | HTTP | **Pass** — `sitemap_index.xml` 200, Rank Math comment present |
| 4 | Post URLs in sitemap | `post-sitemap.xml` | **Pass** — 9 locs (yazılar + **8 articles** incl. #28) |
| 5 | robots.txt sitemap | HTTP | **Pass** — `Sitemap: https://blog.egitim.today/sitemap_index.xml` |
| 6 | Rank Math on site | HTML | **Pass** — rank-math markers on home + sample posts |
| 7 | GSC verification meta | HTML | **Pass** — `google-site-verification` on home |
| 8 | Sample posts canonical | HTTP | **Pass** — #15, #23, #24 return 200 + canonical + Rank Math |
| 9 | URL Inspection (2 URLs) | GSC → URL inspection | **Manual** — pick 2 posts; want Indexed / on Google |
| 10 | Performance 28d impressions | GSC → Performance | **Manual** — **gate** |
| 11 | Queries tab non-empty | GSC → Performance → Queries | **Manual** — **gate** |
| 12 | Pages tab shows WP URLs | GSC → Performance → Pages | **Manual** |
| 13 | 48h stability | Two consecutive days with data | **Manual** — re-check 2026-08-22 |

---

## Decision (2026-08-20)

| Outcome | Action |
|---------|--------|
| GSC UI: **0 clicks / 0 impressions / empty Queries** (Last 3 months) | **No OAuth.** Infra OK (sitemap/Rank Math). Wait for search signal. |
| Code while waiting | Segment platform order fix + CS-11 5-point infographic PNG (in progress / shipped in this cycle) |

---

## What OAuth does *not* fix

- Empty Performance tab → OAuth adds plumbing only.
- Indexing delays → fix in GSC/Rank Math/content, not Studio code.
- HPV volume → DataForSEO (or fallback list), not GSC alone.

---

## Daily 2-minute ritual (until gate opens)

1. GSC Performance → last 28 days → note total impressions + top query.
2. If still zero: URL Inspection on one new post.
3. Log date + impression count in this file (table below).

### Log

| Date | Impressions (28d) | Top query | Notes |
|------|-------------------|-----------|-------|
| 2026-08-20 | **0** (Last 3 months also 0) | _(empty)_ | GSC UI confirmed empty. Rank Math meta+links+categories for 8 posts done. **Next manual:** URL Inspection on #28 + one TYT post. |
