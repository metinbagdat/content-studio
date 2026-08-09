import { bulkPublishDraftPosts } from '../lib/pipeline'
import { syncSocialDraftsFromApprovedCaptions } from '../lib/pipeline'
import { syncPostImagesFromCaptions } from '../lib/social/publishCaption'
import { syncAllAccountStats } from '../lib/social/platformStats'
import { prisma } from '../lib/prisma'

const PLATFORMS = ['LINKEDIN', 'FACEBOOK'] as const
const LIMIT = Number(process.env.BULK_LIMIT || 25)

async function main() {
  await syncSocialDraftsFromApprovedCaptions({ skipImages: true }).catch(() => null)
  await syncPostImagesFromCaptions().catch(() => null)

  for (const platform of PLATFORMS) {
    console.log(`\n=== ${platform} (max ${LIMIT}) ===`)
    const result = await bulkPublishDraftPosts({ platform, limit: LIMIT, includeDryRun: false })
    console.log(JSON.stringify(result, null, 2))
  }

  await syncAllAccountStats().catch(() => null)
  const counts = await prisma.socialMediaPost.groupBy({
    by: ['platform', 'status'],
    _count: { _all: true },
    where: { platform: { in: ['LINKEDIN', 'FACEBOOK', 'TWITTER'] } },
  })
  console.log('\n=== Post counts ===')
  console.table(counts.map((c) => ({ platform: c.platform, status: c.status, n: c._count._all })))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
