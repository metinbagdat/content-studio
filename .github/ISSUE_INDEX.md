# Issue index (Content Studio)

Open GitHub issues from bodies below when the Issues API is available. Until then, treat these files as the tracker (status in `docs/ROADMAP.md`).

| File | ID | Topic |
|------|-----|-------|
| [M0-monorepo.md](./issue-bodies/M0-monorepo.md) | CS-M0 | Workspaces + legacy quarantine |
| [M1-apps-layout.md](./issue-bodies/M1-apps-layout.md) | CS-M1 | Move to apps/web + apps/worker + packages/db |
| [M2-shared-packages.md](./issue-bodies/M2-shared-packages.md) | CS-M2 | packages/core from root lib/ |
| [01-discovery-cron.md](./issue-bodies/01-discovery-cron.md) | CS-00 | Discovery |
| [02-atomization-engine.md](./issue-bodies/02-atomization-engine.md) | CS-01 | Atomization ~50 |
| [03-dalle-images.md](./issue-bodies/03-dalle-images.md) | CS-03 | Images |
| [04-audio-music.md](./issue-bodies/04-audio-music.md) | CS-04 | Audio/music |
| [05-podcast-format.md](./issue-bodies/05-podcast-format.md) | CS-05 | Podcast package |
| [06-platform-publishers.md](./issue-bodies/06-platform-publishers.md) | CS-06 | Extra SM publishers |
| [07-distribution-calendar.md](./issue-bodies/07-distribution-calendar.md) | CS-07 | Calendar |
| [08-performance-tracking.md](./issue-bodies/08-performance-tracking.md) | CS-08 | Metrics loop |
| [09-ffmpeg-video.md](./issue-bodies/09-ffmpeg-video.md) | CS-09 | Short video |
| [10-image-resize.md](./issue-bodies/10-image-resize.md) | CS-10 | Resize |
| [11-platform-captions.md](./issue-bodies/11-platform-captions.md) | CS-02 | All-platform captions |
| [12-infographic-format.md](./issue-bodies/12-infographic-format.md) | CS-11 | Infographic text format |
| [13-sm-marketing-automation-epic.md](./issue-bodies/13-sm-marketing-automation-epic.md) | CS-SM-EPIC | SM marketing automation → [#31](https://github.com/metinbagdat/content-studio/issues/31) |
| [14-meta-app-review-sandbox.md](./issue-bodies/14-meta-app-review-sandbox.md) | CS-SM-00 | Meta App Review / sandbox → [#32](https://github.com/metinbagdat/content-studio/issues/32) |
| [15-audience-segmentation.md](./issue-bodies/15-audience-segmentation.md) | CS-SM-01 | Audience segments → [#33](https://github.com/metinbagdat/content-studio/issues/33) |
| [29-social-segment-badge-fallback.md](./issue-bodies/29-social-segment-badge-fallback.md) | CS-SM-01b | Sosyal segment rozeti + `seg:` fallback → [#56](https://github.com/metinbagdat/content-studio/issues/56) |
| [16-wordpress-publisher.md](./issue-bodies/16-wordpress-publisher.md) | CS-WP-01 | WP draft publisher → [#34](https://github.com/metinbagdat/content-studio/issues/34) |
| [17-safe-samurai-gate.md](./issue-bodies/17-safe-samurai-gate.md) | CS-WP-02 | Safe samurAI pre-send gate → [#35](https://github.com/metinbagdat/content-studio/issues/35) |
| [18-seo-hpv-trigger.md](./issue-bodies/18-seo-hpv-trigger.md) | CS-WP-03 | HPV / SEO topic trigger → [#36](https://github.com/metinbagdat/content-studio/issues/36) |
| [27-gsc-oauth-refresh.md](./issue-bodies/27-gsc-oauth-refresh.md) | CS-WP-03b | GSC OAuth refresh (after indexed posts) → [#51](https://github.com/metinbagdat/content-studio/issues/51) |
| [19-wordpress-publish-webhook.md](./issue-bodies/19-wordpress-publish-webhook.md) | CS-WP-04 | WP publish → SM webhook → [#37](https://github.com/metinbagdat/content-studio/issues/37) **closed** |
| [28-canonical-blog-is-wordpress.md](./issue-bodies/28-canonical-blog-is-wordpress.md) | CS-WP-05 | Canonical long-form = `blog.egitim.today`; LearnCon `/blog` 301 → [#52](https://github.com/metinbagdat/content-studio/issues/52) |
| [20-hostinger-reach-contacts.md](./issue-bodies/20-hostinger-reach-contacts.md) | CS-EM-01 | Hostinger Reach contact API → [#38](https://github.com/metinbagdat/content-studio/issues/38) |
| [21-hostinger-reach-admin.md](./issue-bodies/21-hostinger-reach-admin.md) | CS-EM-02 | Admin `/admin/email` → [#39](https://github.com/metinbagdat/content-studio/issues/39) |
| [22-hostinger-reach-wp-nudge.md](./issue-bodies/22-hostinger-reach-wp-nudge.md) | CS-EM-03 | WP yayın → Reach bülten hatırlatması → [#40](https://github.com/metinbagdat/content-studio/issues/40) |
| [23-social-disconnect-reactivate.md](./issue-bodies/23-social-disconnect-reactivate.md) | CS-SM | Disconnect revived by token refresh / dry-run → [#41](https://github.com/metinbagdat/content-studio/issues/41) |
| [24-sm-seo-from-social.md](./issue-bodies/24-sm-seo-from-social.md) | CS-SM-SEO | SM vs blog SEO tracker → [#47](https://github.com/metinbagdat/content-studio/issues/47) |
| [25-sm-seo-canonical-urls.md](./issue-bodies/25-sm-seo-canonical-urls.md) | CS-SM-SEO-01 | WP URL on captions/YT descriptions → [#48](https://github.com/metinbagdat/content-studio/issues/48) |
| [26-sm-durable-video-and-youtube-seo.md](./issue-bodies/26-sm-durable-video-and-youtube-seo.md) | CS-SM-SEO-02/03 | Durable MP4 + YouTube SEO upload → [#49](https://github.com/metinbagdat/content-studio/issues/49) |

WordPress SEO hub plugins live in **`metinbagdat/wp-seo-hub`**. Canonical long-form blog is **`blog.egitim.today`**. LearnCon `/blog` is product news; long-form 301s merged ([learncon#1328](https://github.com/metinbagdat/learncon/pull/1328)). **7 WP articles** live (#15/#20/#23–#27). Durable GSC OAuth (CS-WP-03b) waits until GSC shows **impressions**, not merely published URLs. **Do not** connect Soro autopilot. Root `lib/` stays until **CS-M2**. LearnCon **LC-G6** stays in `metinbagdat/learncon`.
