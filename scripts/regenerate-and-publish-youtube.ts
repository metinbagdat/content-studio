import { prisma } from '../lib/prisma'
import { generateVideoVariants } from '../lib/video/generateVideo'
import { preparePostForPublish } from '../lib/social/preparePublish'
import { publishPost } from '../lib/social/publish'

const TARGET_ID = '0ad25222-4ce6-4140-862d-efdb03cc8187'

async function main() {
  const derived = await prisma.derivedContent.findUnique({ where: { id: TARGET_ID } })
  if (!derived) throw new Error('Script not found')
  console.log('Target:', derived.title)

  console.log('Deleting old video files...')
  const old = await prisma.mediaFile.findMany({
    where: { derivedContentId: TARGET_ID, mediaType: 'VIDEO' },
  })
  for (const m of old) {
    await prisma.mediaFile.delete({ where: { id: m.id } }).catch(() => {})
  }

  console.log('Regenerating video (TTS + images + ffmpeg)...')
  const variants = await generateVideoVariants(TARGET_ID, ['16:9'])
  if (!variants.length) throw new Error('Video üretilemedi')
  console.log('Video ready:', variants[0].publicUrl)

  let post = await prisma.socialMediaPost.findFirst({
    where: {
      derivedContentId: TARGET_ID,
      platform: 'YOUTUBE',
      account: { accountId: { not: { startsWith: 'dryrun_' } } },
    },
    include: { account: true },
  })
  if (!post) throw new Error('YouTube post bulunamadı — önce OAuth bağlayın')

  console.log('Post:', post.id, post.status, post.account.accountName)
  await preparePostForPublish(post.id)

  console.log('Uploading to YouTube...')
  const result = await publishPost(post.id, { requireVideo: true, force: true, replace: true })
  console.log('Result:', JSON.stringify(result, null, 2))

  if (result.platformPostId && !result.platformPostId.startsWith('mock_')) {
    console.log('\n✓ Canlı:', `https://www.youtube.com/watch?v=${result.platformPostId}`)
  }
}

main().finally(() => prisma.$disconnect())
