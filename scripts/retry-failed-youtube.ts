import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { preparePostForPublish } from '../lib/social/preparePublish'
import { publishPost } from '../lib/social/publish'

async function main() {
  const failed = await prisma.socialMediaPost.findMany({
    where: { platform: 'YOUTUBE', status: 'FAILED' },
    include: { derivedContent: { select: { title: true } } },
  })

  console.log(`${failed.length} failed post(s) found`)

  for (const post of failed) {
    console.log(`\nRetrying: ${post.derivedContent?.title}`)
    try {
      await preparePostForPublish(post.id)
      const result = await publishPost(post.id, { requireVideo: true })
      console.log('SUCCESS:', result.platformPostId)
    } catch (err) {
      console.error('FAILED AGAIN:', err instanceof Error ? err.message : String(err))
    }
  }
}

main().finally(() => prisma.$disconnect())