import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { syncYouTubeFromApprovedVideos } from '../lib/social/youtubeBackfill'

async function main() {
  console.log('Starting YouTube backfill (limit: 1, publishNow: true)...')
  const start = Date.now()

  const result = await syncYouTubeFromApprovedVideos({
    limit: 1,
    generateVideo: true,
    schedule: false,
    publishNow: true,
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`Done in ${elapsed}s`)
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())