import { prisma } from '../lib/prisma'
import { deactivateAccount } from '../lib/social/oauth'

async function main() {
  const dry = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'YOUTUBE', accountId: 'dryrun_youtube' },
  })
  if (dry) {
    await deactivateAccount(dry.id)
    console.log('Dry-run YouTube deactivated:', dry.id)
  } else {
    console.log('No dry-run YouTube account')
  }

  const videos = await prisma.mediaFile.findMany({
    where: { mediaType: 'VIDEO', processingStatus: 'COMPLETED' },
    take: 5,
    select: { id: true, derivedContentId: true, fileUrl: true, duration: true },
  })
  console.log('Completed videos:', JSON.stringify(videos, null, 2))
}

main().finally(() => prisma.$disconnect())
