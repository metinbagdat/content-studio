## Meta
- **ID:** CS-WP-05
- **Repo:** content-studio (+ LearnCon 301s)
- **GitHub:** [#52](https://github.com/metinbagdat/content-studio/issues/52)
- [x] First migrate: `zamani-zafere-donusturmek` → WP **#23** `https://blog.egitim.today/zamani-zafere-donusturmek/`

## Decision

**Canonical long-form SEO = `https://blog.egitim.today/` (WordPress).**  
Do **not** keep a second copy of the same article on `https://www.egitim.today/blog/{slug}`.

LearnCon `/blog` stays for **product news / Haberler** (in-app feed), not Rank Math / GSC demand gen.

## Content Studio

- [x] Discovery default origin = WordPress sitemap (`DISCOVERY_ORIGIN=wordpress`)
- [x] First migrate: `zamani-zafere-donusturmek` → WP **#23** `https://blog.egitim.today/zamani-zafere-donusturmek/`
- [x] Remaining LearnCon editorial posts migrated: WP **#24–#27** (`lgs-6-ay-calisma-plani`, `tyt-matematik-7-gun-tekrar`, `ayt-turk-dili-edebiyat-tam-rehber`, `tyt-matematik-90-almak-icin-stratejiler`)

## LearnCon (not this repo)

- [ ] After each WP URL is live: 301 `/blog/{slug}` → `https://blog.egitim.today/{slug}` (LearnCon PR: `feat/blog-haberler-only-wp-hub`)
- [ ] Canonical / OG on leftover `/blog` index must not compete with WP posts
- [ ] Haberler feed can link WP URLs or keep short product notes only

## Done when

- New WP publishes → CS ingest via webhook **or** daily WP sitemap discovery
- SM captions use `wp-link:` (`blog.egitim.today/...`)
- No duplicate Google index of the same article on both hosts
