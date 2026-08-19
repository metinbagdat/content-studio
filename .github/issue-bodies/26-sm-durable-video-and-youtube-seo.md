## Meta
- **ID:** CS-SM-SEO-02 / CS-SM-SEO-03
- **Repo:** content-studio
- **Parent:** CS-SM-SEO
- **GitHub:** [#49](https://github.com/metinbagdat/content-studio/issues/49)

## Summary

YouTube is the only SM surface Google indexes as **video results**. Upload is blocked in prod today: MP4s live on the operator PC (`storage/videos`), Vercel Hobby has no disk, local Docker worker does not see prod jobs, and `SOCIAL_AUTOPILOT=false` on Production.

TikTok has the same media problem **plus** dry-run OAuth (CS-06 / #2).

## Why not immediately

- Regenerating 11 shorts + long video against Supabase burns Hobby egress
- Uploading from a laptop is a one-shot, not a durable pipeline
- TikTok App Review is not a same-day task

## Scope — durable media (02)

- [ ] Store completed MP4 (and podcast audio) where the **prod** publish path can read it (object storage or equivalent), not only `storage/` on one machine
- [ ] `ensureGeneratedVideo` / YouTube upload use that URL or a fetchable `fileUrl`
- [ ] Document: local generate → upload to store → `publishPost(YOUTUBE)`

## Scope — YouTube SEO publish (03)

Depends on CS-SM-SEO-01 (canonical URL) + 02 (file).

- [ ] One-shot or admin: drain **scheduled** YouTube rows for a WP source when MP4 exists
- [ ] Description: WP canonical + `egitim.today` CTA + tags (`egitim`, topic, Shorts if 9:16)
- [ ] Privacy: public for SEO (or unlisted until review — env `YOUTUBE_PRIVACY`)
- [ ] Do not auto-upload 11 shorts in one burst (quota / spam)

## Done when

- A WP article can result in ≥1 public YouTube video whose description links `blog.egitim.today/...` without needing that laptop’s disk
- TikTok remains out of scope until #2 real OAuth

## Start when

After CS-SM-SEO-01; object storage decision (or accept “operator runs YouTube upload locally with `CS_ALLOW_SUPABASE_WORKER=1`” as a documented stopgap).
