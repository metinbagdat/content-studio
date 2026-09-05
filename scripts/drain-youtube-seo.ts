/**
 * CS-SM-SEO-03 — controlled YouTube SEO drain (1 long-form by default).
 *
 * Flow:
 *   1) Local: generate MP4 (ffmpeg) with BLOB_READ_WRITE_TOKEN → videos/{id}.mp4
 *   2) Or backfill: npx tsx --env-file=.env scripts/upload-videos-to-blob.ts --limit=5
 *   3) This script: draft + publish ONE durable video (no Shorts burst)
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/drain-youtube-seo.ts --dry
 *   npx tsx --env-file=.env scripts/drain-youtube-seo.ts --publish
 *   npx tsx --env-file=.env scripts/drain-youtube-seo.ts --source=<contentSourceId> --publish
 *   npx tsx --env-file=.env scripts/drain-youtube-seo.ts --wp=blog.egitim.today --publish
 *   npx tsx --env-file=.env scripts/drain-youtube-seo.ts --derived=<derivedId> --publish
 *
 * Privacy: YOUTUBE_PRIVACY=public|unlisted|private (default public)
 */
import { syncYouTubeFromApprovedVideos } from '../lib/social/youtubeBackfill'
import { prisma } from '../lib/prisma'

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

async function main() {
  const publish = process.argv.includes('--publish')
  const dry = process.argv.includes('--dry') || !publish
  const sourceId = arg('source')
  const derivedId = arg('derived')
  const wp = arg('wp')
  const limit = Math.max(1, Number(arg('limit') || 5))
  const maxPublish = Math.max(1, Number(arg('max') || 1))

  console.log({
    mode: dry ? 'dry (draft/schedule only)' : 'publish',
    sourceId,
    derivedId,
    wp,
    limit,
    maxPublish,
    privacy: process.env.YOUTUBE_PRIVACY || 'public',
  })

  const result = await syncYouTubeFromApprovedVideos({
    limit,
    maxPublish: dry ? 0 : maxPublish,
    preferLongForm: true,
    sourceId,
    derivedId,
    wpLinkContains: wp,
    generateVideo: false,
    requireDurableVideo: true,
    schedule: true,
    publishNow: !dry,
  })

  console.log(JSON.stringify(result, null, 2))
  for (const id of result.publishedIds) {
    if (id && !id.startsWith('mock_')) {
      console.log('Live:', `https://www.youtube.com/watch?v=${id}`)
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
