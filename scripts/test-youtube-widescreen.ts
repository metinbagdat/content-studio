import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { ensureGeneratedVideo, buildYouTubePostContent } from '../lib/social/publishVideo'
import { createSocialDraftsForDerived } from '../lib/pipeline'
import { preparePostForPublish } from '../lib/social/preparePublish'
import { publishPost } from '../lib/social/publish'

async function main() {
  const script = await prisma.derivedContent.findFirst({
    where: {
      contentType: 'VIDEO_SCRIPT', // sadece uzun format — SHORT_VIDEO_SCRIPT değil
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
    orderBy: { approvedAt: 'asc' },
  })

  if (!script) {
    console.error('Onaylı bir VIDEO_SCRIPT bulunamadı')
    return
  }
  console.log('Found:', script.id, script.title)

  console.log('Generating 16:9 video...')
  const video = await ensureGeneratedVideo(script.id)
  console.log('Video ready:', video)

  const postContent = buildYouTubePostContent({
    title: script.title,
    content: script.content,
    contentType: script.contentType,
    metadata: script.metadata,
  })

  console.log('Creating social draft...')
  await createSocialDraftsForDerived(script.id, postContent, { skipImages: true })

  const post = await prisma.socialMediaPost.findFirst({
    where: { derivedContentId: script.id, platform: 'YOUTUBE' },
    include: { account: true },
  })
  if (!post) {
    console.error('YouTube draft oluşturulamadı — hesap bağlı mı kontrol et')
    return
  }

  console.log('Publishing to YouTube...')
  await preparePostForPublish(post.id)
  const result = await publishPost(post.id, { requireVideo: true })
  console.log('PUBLISH RESULT:', JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error('ERROR:', err)
  })
  .finally(() => prisma.$disconnect())