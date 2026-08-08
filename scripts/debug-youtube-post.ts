import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  const posts = await prisma.socialMediaPost.findMany({
    where: { platform: 'YOUTUBE' },
    include: { account: true, derivedContent: { select: { title: true, contentType: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  console.log(JSON.stringify(
    posts.map((p) => ({
      id: p.id,
      derivedContentId: p.derivedContentId,
      title: p.derivedContent?.title,
      status: p.status,
      platformPostId: p.platformPostId,
      error: p.error,
      accountId: p.account.accountId,
      accountActive: p.account.isActive,
      createdAt: p.createdAt,
    })),
    null,
    2,
  ))
}

main().finally(() => prisma.$disconnect())