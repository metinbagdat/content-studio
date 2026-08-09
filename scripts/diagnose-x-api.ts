import { prisma } from '../lib/prisma'
import { probeXWriteAccess, xApiDiagnosis } from '../lib/social/xApi'
import { getValidAccessToken } from '../lib/social/tokenRefresh'

async function main() {
  const account = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'TWITTER', isActive: true, NOT: { accountId: { startsWith: 'dryrun_' } } },
  })
  if (!account) {
    console.log('Aktif X OAuth hesabı yok')
    return
  }

  const diag = xApiDiagnosis(true)
  console.log('=== X API Diagnosis ===')
  console.log(JSON.stringify(diag, null, 2))

  const token = await getValidAccessToken(account)
  const probe = await probeXWriteAccess(token)
  console.log('\n=== Probe (users/me unless X_TEST_TWEET=true) ===')
  console.log(probe)

  const failed = await prisma.socialMediaPost.count({
    where: { platform: 'TWITTER', status: 'FAILED', error: { contains: '403' } },
  })
  console.log(`\nFailed X posts (403): ${failed}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
