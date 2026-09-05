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

- [x] Store completed MP4 where the **prod** publish path can read it (Vercel Blob `videos/{id}.mp4`)
- [x] `ensureGeneratedVideo` / YouTube·TikTok use durable `fileUrl` (disk first, else Blob fetch); no regenerate on Vercel
- [x] Document: local generate → Blob (`BLOB_READ_WRITE_TOKEN`) → `publishPost(YOUTUBE)`; backfill `scripts/upload-videos-to-blob.ts`
- [x] `/api/media/{id}/video` **302** to Blob (no function byte egress)

## Scope — YouTube SEO publish (03)

Depends on CS-SM-SEO-01 (canonical URL) + 02 (file).

- [x] One-shot: `scripts/drain-youtube-seo.ts` + `prod-social-drain.mjs youtube-seo` (max 1, long-form first)
- [x] Description: WP canonical + `egitim.today` CTA + tags (`egitim`, topic, Shorts if 9:16)
- [x] Privacy: `YOUTUBE_PRIVACY` (default public)
- [x] Do not auto-upload 11 shorts in one burst (`maxPublish` default 1; Shorts skipped when long-form exists)
- [x] Require durable Blob `fileUrl` before publish (no Vercel ffmpeg regenerate)

## Done when

- A WP article can result in ≥1 public YouTube video whose description links `blog.egitim.today/...` without needing that laptop’s disk
- TikTok remains out of scope until #2 real OAuth

## Operator checklist

1. Vercel Blob connected (`BLOB_READ_WRITE_TOKEN` in local `.env` for generate/upload)
2. Local: generate video → Blob `videos/{id}.mp4` (or `upload-videos-to-blob.ts`)
3. `npx tsx --env-file=.env scripts/drain-youtube-seo.ts --wp=blog.egitim.today --publish`
4. Confirm live URL + description has Yazı: `https://blog.egitim.today/...`