## Meta
- **ID:** CS-SM-SEO
- **Repo:** content-studio
- **GitHub:** [#47](https://github.com/metinbagdat/content-studio/issues/47)

## Summary

Social posts do **not** put `blog.egitim.today` into Rank Math / GSC by themselves. SM helps SEO only as **distribution + (YouTube) indexed video** that points at the canonical WP article.

## What “SM entered SEO” actually means

| Channel | SEO effect | Status 2026-08-19 |
|---------|------------|-------------------|
| WordPress article | Canonical page, Rank Math, GSC | Live (`#15`, `#20`) |
| LinkedIn / X / IG / FB / TikTok | Traffic + branded search, **not** blog ranking | LI: 3 live; others scheduled/draft |
| YouTube | Google/YouTube index **if uploaded** + description link to WP | 3 scheduled, **not uploaded** |
| LearnCon `/blog` | Duplicate SEO — **do not** copy WP articles | Keep off |

## Do now (ops — not this issue)

- GSC property `https://blog.egitim.today/` + sitemap `https://blog.egitim.today/wp-sitemap.xml`
- Every WP post CTA → `https://egitim.today` **and** unique URL on `blog.egitim.today`
- Do not republish the same article on `www.egitim.today/blog/...`

## Do **not** do immediately (this tracker)

- [ ] Drain all X / IG / FB / TikTok queues (X credits; Meta App Review #32; TikTok dry-run; Hobby egress)
- [ ] TikTok production OAuth (#2 / CS-06)
- [ ] Meta Live + Advanced Access (#32)
- [ ] Pinterest API
- [ ] Hostinger Reach blast (CS-EM, after more posts)

## Code / infra follow-ups

- [ ] CS-SM-SEO-01 — WP canonical URL on captions + YouTube descriptions (`wp-link:`)
- [ ] CS-SM-SEO-02 — Durable video files so prod can upload YouTube/TikTok
- [ ] CS-SM-SEO-03 — YouTube publish + SEO description pack (after 01+02)

## Done when

- New WP articles produce SM copy that includes `https://blog.egitim.today/...`
- At least one Short + one long YouTube video live with that URL in the description
- Scheduled X/IG/FB only after credits / App Review — not a silent bulk fail
