## Meta
- **ID:** CS-SM-SEO-01
- **Repo:** content-studio
- **Parent:** CS-SM-SEO
- **GitHub:** [#48](https://github.com/metinbagdat/content-studio/issues/48)

## Summary

WP ingest stores `wp-link:https://blog.egitim.today/...` on the source, but the pipeline only passes `articleUrl` when tags have `blog:` (LearnCon blog slug). Atomized captions therefore CTA to `https://egitim.today` (`brandCta()`), not the indexed article. YouTube descriptions hardcode `🔗 egitim.today` with no WP URL.

Google/YouTube cannot treat SM as supporting the **canonical** post.

## Repro

1. Publish on WordPress → webhook → `ContentSource.tags` includes `wp-link:...`
2. `processPipeline` in `lib/pipeline.ts` (~137): `articleUrl` is `undefined` unless `blog:` tag exists
3. `generateAllDerivatives` / caption series / YouTube `buildYouTubeMetadata` omit the article URL

## Scope

- [x] Resolve canonical URL: `wp-link:` first, else `blog:` → `https://www.egitim.today/blog/{slug}` (LearnCon only if that is the source)
- [x] Pass it into atomization + YouTube description builder
- [x] Caption CTA: product `egitim.today` **plus** one line “Yazı: {canonical}” (respect platform maxChars)
- [x] Do **not** point SM at `www.egitim.today/blog/...` when the source is WP

## Done when

- New WP-ingested pipeline captions and YouTube descriptions contain `blog.egitim.today/...`
- Unit or smoke: source with only `wp-link:` gets that URL

## Start when

Anytime — small, no OAuth. Do before the next WP article pipeline if possible.
