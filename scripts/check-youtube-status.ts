import { prisma } from '../lib/prisma'

async function main() {
  const yt = await prisma.socialMediaAccount.findMany({
    where: { platform: 'YOUTUBE' },
    select: { id: true, accountName: true, accountId: true, isActive: true, config: true, updatedAt: true },
  })
  const scripts = await prisma.derivedContent.findMany({
    where: {
      contentType: { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
    select: { id: true, title: true, contentType: true, status: true },
    take: 10,
  })
  const ytPosts = await prisma.socialMediaPost.findMany({
    where: { platform: 'YOUTUBE' },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      status: true,
      platformPostId: true,
      postContent: true,
      createdAt: true,
      account: { select: { accountName: true, accountId: true } },
    },
  })
  console.log('YT accounts:', JSON.stringify(yt, null, 2))
  console.log('Approved video scripts:', scripts.length)
  console.log(JSON.stringify(scripts, null, 2))
  console.log(
    'Recent YT posts:',
    JSON.stringify(
      ytPosts.map((p) => ({
        ...p,
        postContent: p.postContent.slice(0, 70),
        isMock: p.platformPostId?.startsWith('mock_'),
      })),
      null,
      2,
    ),
  )
}

main().finally(() => prisma.$disconnect())
