import { prisma } from '../lib/prisma'

async function main() {
  const g = await prisma.socialMediaPost.groupBy({
    by: ['platform', 'status'],
    _count: true,
    where: { platform: { in: ['LINKEDIN', 'FACEBOOK', 'TWITTER'] } },
  })
  console.table(g.map((x) => ({ platform: x.platform, status: x.status, n: x._count })))

  const acc = await prisma.socialMediaAccount.findMany({
    where: { platform: { in: ['TWITTER', 'LINKEDIN', 'FACEBOOK'] }, isActive: true },
  })
  console.log(
    'accounts',
    acc.map((a) => ({
      platform: a.platform,
      name: a.accountName,
      id: a.accountId.slice(0, 24),
      dry: a.accountId.startsWith('dryrun_'),
      oauth: a.config,
    })),
  )

  const publishable = await prisma.socialMediaPost.count({
    where: {
      platform: { in: ['LINKEDIN', 'FACEBOOK'] },
      status: { in: ['DRAFT', 'FAILED'] },
      account: { isActive: true, NOT: { accountId: { startsWith: 'dryrun_' } } },
    },
  })
  console.log('publishable LI+FB:', publishable)

  const fb = await prisma.socialMediaPost.groupBy({
    by: ['status'],
    _count: true,
    where: { platform: 'FACEBOOK' },
  })
  console.log('Facebook posts:', fb)

  const twAcc = await prisma.socialMediaAccount.findMany({
    where: { platform: 'TWITTER' },
  })
  console.log(
    'Twitter accounts:',
    twAcc.map((a) => ({ name: a.accountName, active: a.isActive, id: a.accountId.slice(0, 20) })),
  )
}

main()
  .finally(() => prisma.$disconnect())
