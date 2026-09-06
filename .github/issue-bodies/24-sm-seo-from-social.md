## Meta
- **ID:** CS-SM-SEO
- **Repo:** content-studio
- **GitHub:** [#47](https://github.com/metinbagdat/content-studio/issues/47) **closed**

## Summary

Social posts do **not** put `blog.egitim.today` into Rank Math / GSC by themselves. SM helps SEO only as **distribution + (YouTube) indexed video** that points at the canonical WP article.

## What “SM entered SEO” actually means

| Channel | SEO effect | Status 2026-09-06 |
|---------|------------|-------------------|
| WordPress article | Canonical page, Rank Math, GSC | Live |
| LinkedIn / X / IG / FB / TikTok | Traffic + branded search, **not** blog ranking | LI/FB live; X credits; Meta/TikTok gated |
| YouTube | Google/YouTube index **if uploaded** + description link to WP | **Live** [ZSVB9d1Z0Ns](https://www.youtube.com/watch?v=ZSVB9d1Z0Ns) + Yazı blog link |
| LearnCon `/blog` | Duplicate SEO — **do not** copy WP articles | Keep off |

## Code / infra follow-ups

- [x] CS-SM-SEO-01 — WP canonical URL on captions + YouTube descriptions (`wp-link:`) → [#48](https://github.com/metinbagdat/content-studio/issues/48)
- [x] CS-SM-SEO-02 — Durable video files so prod can publish YouTube/TikTok → [#49](https://github.com/metinbagdat/content-studio/issues/49)
- [x] CS-SM-SEO-03 — YouTube publish + SEO description pack → [#49](https://github.com/metinbagdat/content-studio/issues/49)

## Ops next (not this tracker)

- Local ffmpeg → Blob → `youtube-seo` for more long-form (Arı video faults)
- Podcast MP3 drain on `/admin/media`
- X credits; Meta #32; TikTok OAuth; Pinterest; Reach after GSC impressions

## Done when

- [x] New WP articles produce SM copy that includes `https://blog.egitim.today/...`
- [x] At least one long YouTube video live with that URL in the description
- [ ] Short optional later; X/IG/FB only after credits / App Review
