import { prisma } from '../lib/prisma'

async function main() {
  const account = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'FACEBOOK', accountId: { not: { startsWith: 'dryrun_' } } },
  })
  if (!account) return console.log('no account')
  console.log(JSON.stringify(account.config, null, 2))
}

main().finally(() => prisma.$disconnect())
