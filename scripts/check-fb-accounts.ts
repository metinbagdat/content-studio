import { prisma } from '../lib/prisma'

async function main() {
  const accounts = await prisma.socialMediaAccount.findMany({
    where: { platform: { in: ['FACEBOOK', 'INSTAGRAM'] } },
    select: { id: true, platform: true, accountName: true, isActive: true, accountId: true },
  })
  console.log(JSON.stringify(accounts, null, 2))
}

main().finally(() => prisma.$disconnect())
