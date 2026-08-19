## Meta
- **ID:** CS-WP-03b
- **Repo:** content-studio
- **Parent:** CS-WP-03 / #36
- **GitHub:** [#51](https://github.com/metinbagdat/content-studio/issues/51)

## Summary

GSC overlay (`fetchGscQueries`) is real Search Console API code, but auth is a **manual short-lived** `GSC_ACCESS_TOKEN`. There is no refresh-token store like X/LinkedIn (`lib/social/tokenRefresh.ts`).

Do **not** build this until `blog.egitim.today` queries exist. Two live posts (#15, #20) still need crawl/index; GSC searchAnalytics will be empty or noisy until then. Same timing as Reach newsletter: after a small indexed corpus (target 3–5 posts + sitemap in GSC).

## Start when

- [ ] GSC property has impressions on `blog.egitim.today` (not Rank Math wizard Google login)
- [ ] At least ~3 indexed articles (or ~2 weeks after first publishes)

## Scope

- [ ] Google OAuth (webmasters readonly) → store encrypted refresh token (reuse `encryptSecret`)
- [ ] Admin connect button or one-time `/api/seo/gsc/callback`
- [ ] `fetchGscQueries` uses refreshed access token; skip if unset (today’s behavior)
- [ ] Env: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN` (or DB row) — not a pasted access token
- [ ] Docs in `docs/WORDPRESS_BRIDGE.md`

## Out of scope now

- Full topic-engine rewrite
- Using GSC as the only HPV source (DataForSEO remains primary when creds exist)

## Done when

- Studio can pull 28-day queries overnight without pasting a new Bearer token
