import { prisma } from '../lib/prisma'
import { getValidAccessToken } from '../lib/social/tokenRefresh'

async function g(url: string) {
  const res = await fetch(url)
  const json = await res.json()
  return json
}

async function main() {
  const account = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'FACEBOOK', accountId: { not: { startsWith: 'dryrun_' } } },
  })
  if (!account) {
    console.log('No real Facebook account')
    return
  }

  const token = await getValidAccessToken(account)
  console.log('Account:', account.accountName, account.accountId)

  const me = await g(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${token}`)
  console.log('me:', JSON.stringify(me, null, 2))

  const businesses = await g(
    `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,verification_status&access_token=${token}`,
  )
  console.log('businesses:', JSON.stringify(businesses, null, 2))

  const bizList = (businesses as { data?: Array<{ id: string; name: string }> }).data || []
  for (const biz of bizList) {
    const domains = await g(
      `https://graph.facebook.com/v21.0/${biz.id}/owned_domains?fields=id,domain_name,verification_status,verification_code&access_token=${token}`,
    )
    console.log(`domains for ${biz.name}:`, JSON.stringify(domains, null, 2))
  }

  const page = await g(
    `https://graph.facebook.com/v21.0/${account.accountId}?fields=id,name,link&access_token=${token}`,
  )
  console.log('page:', JSON.stringify(page, null, 2))
}

main().finally(() => prisma.$disconnect())
