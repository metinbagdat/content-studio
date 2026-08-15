import { prisma } from '../lib/prisma'

async function main() {
  const caps = await prisma.derivedContent.findMany({
    where: { contentType: 'SOCIAL_CAPTION', status: 'APPROVED' },
    take: 5,
    select: { id: true, metadata: true },
  })
  console.log('sample metadata', caps)

  const withPlatform = await prisma.derivedContent.count({
    where: {
      contentType: 'SOCIAL_CAPTION',
      status: { in: ['APPROVED', 'PUBLISHED'] },
      NOT: { metadata: { equals: null } },
    },
  })
  console.log('approved captions', withPlatform)

  const fbPosts = await prisma.socialMediaPost.count({ where: { platform: 'FACEBOOK' } })
  console.log('fb posts total', fbPosts)
}

main().finally(() => prisma.$disconnect())
