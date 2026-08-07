#!/usr/bin/env npx tsx
/**
 * YouTube OAuth smoke test (no browser).
 * Usage: npx tsx --env-file=.env scripts/test-youtube-oauth.ts
 */
import { oauthPlatformStatus } from '../lib/social/config'
import { getAuthUrl } from '../lib/social/oauth'
import { prisma } from '../lib/prisma'
import { decryptSecret } from '../lib/crypto'
import { testYouTubeConnection } from '../lib/social/youtubeApi'

async function main() {
  const oauth = oauthPlatformStatus()
  console.log('\n=== YouTube OAuth env ===')
  console.log('configured:', oauth.youtube.configured)
  console.log('callback:', oauth.youtube.callbackUrl)
  console.log('scopes:', oauth.youtube.scopes)

  if (!oauth.youtube.configured) {
    console.error('\nYOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET eksik (.env)')
    process.exit(1)
  }

  console.log('\n=== Auth URL (tarayıcıda aç) ===')
  console.log(getAuthUrl('YOUTUBE', 'cli-test'))

  const account = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'YOUTUBE', isActive: true, accountId: { not: { startsWith: 'dryrun_' } } },
    orderBy: { updatedAt: 'desc' },
  })

  if (!account) {
    console.log('\nBağlı OAuth hesabı yok → /admin/social → YouTube → OAuth bağla')
    return
  }

  const token = decryptSecret(account.accessToken)
  if (token === 'dry-run') {
    console.log('\nDry-run hesap — gerçek OAuth bağla')
    return
  }

  console.log('\n=== Bağlı hesap ===')
  console.log(account.accountName, account.accountId)

  const result = await testYouTubeConnection(token)
  console.log('\n=== API test ===')
  console.log(JSON.stringify(result, null, 2))
}

main().finally(() => prisma.$disconnect())
