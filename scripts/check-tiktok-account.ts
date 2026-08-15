import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  const accounts = await prisma.socialMediaAccount.findMany({
    where: { platform: 'TIKTOK' },
  })
  console.log(JSON.stringify(
    accounts.map((a) => ({
      accountId: a.accountId,
      accountName: a.accountName,
      isActive: a.isActive,
      isDryRun: a.accountId.startsWith('dryrun_'),
      hasRefreshToken: Boolean(a.refreshToken),
      createdAt: a.createdAt,
    })),
    null,
    2,
  ))
}

main().finally(() => prisma.$disconnect())