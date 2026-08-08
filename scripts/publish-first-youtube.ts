import { prisma } from '../lib/prisma'
import { syncYouTubeFromApprovedVideos } from '../lib/social/youtubeBackfill'
import { preparePostForPublish } from '../lib/social/preparePublish'
import { publishPost } from '../lib/social/publish'

const TARGET_ID = '0ad25222-4ce6-4140-862d-efdb03cc8187' // Zamanı Zafere — video MP4 hazır

async function main() {
  const derived = await prisma.derivedContent.findUnique({ where: { id: TARGET_ID } })
  if (!derived) throw new Error('Script not found')

  console.log('Target:', derived.title)

  let post = await prisma.socialMediaPost.findFirst({
    where: {
      derivedContentId: TARGET_ID,
      platform: 'YOUTUBE',
      account: { accountId: { not: { startsWith: 'dryrun_' } } },
    },
    include: { account: true },
  })

  if (!post) {
    console.log('No YouTube post — running backfill draft creation...')
    await syncYouTubeFromApprovedVideos({
      limit: 20,
      generateVideo: false,
      schedule: false,
      publishNow: false,
    })
    post = await prisma.socialMediaPost.findFirst({
      where: {
        derivedContentId: TARGET_ID,
        platform: 'YOUTUBE',
        account: { accountId: { not: { startsWith: 'dryrun_' } } },
      },
      include: { account: true },
    })
  }

  if (!post) throw new Error('YouTube draft oluşturulamadı')

  console.log('Post:', post.id, post.status, post.account.accountName)
  console.log('Preparing video...')
  await preparePostForPublish(post.id)

  console.log('Uploading to YouTube...')
  const result = await publishPost(post.id, { requireVideo: true, force: true })
  console.log('Result:', JSON.stringify(result, null, 2))

  if (result.platformPostId && !result.platformPostId.startsWith('mock_')) {
    console.log('\n✓ Canlı:', `https://www.youtube.com/watch?v=${result.platformPostId}`)
  }
}

main().finally(() => prisma.$disconnect())
