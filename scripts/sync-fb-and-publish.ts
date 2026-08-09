import { prisma } from '../lib/prisma'
import { syncSocialDraftsFromApprovedCaptions, backfillFacebookDraftsFromCaptions } from '../lib/pipeline'
import { bulkPublishDraftPosts } from '../lib/pipeline'

async function main() {
  const baghdat = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'TWITTER', accountName: { contains: 'Baghdat' } },
  })
  if (baghdat) {
    await prisma.socialMediaAccount.update({
      where: { id: baghdat.id },
      data: { isActive: true },
    })
    await prisma.socialMediaAccount.updateMany({
      where: { platform: 'TWITTER', accountId: { startsWith: 'dryrun_' } },
      data: { isActive: false },
    })
    console.log('Reactivated:', baghdat.accountName)
  }

  const fbBackfill = await backfillFacebookDraftsFromCaptions({ skipImages: true })
  console.log('Facebook backfill:', fbBackfill)

  const sync = await syncSocialDraftsFromApprovedCaptions({ skipImages: true })
  console.log('Draft sync:', sync)

  for (const platform of ['FACEBOOK', 'LINKEDIN'] as const) {
    const r = await bulkPublishDraftPosts({ platform, limit: 25, includeDryRun: false })
    console.log(platform, r)
  }
}

main()
  .finally(() => prisma.$disconnect())
