import { prisma } from '../lib/prisma'
import { getValidAccessToken } from '../lib/social/tokenRefresh'
import { metaAppId, metaAppSecret, metaGraphVersion, metaLoginConfigId, metaLoginConfigIdPublish, metaOAuthConfigId } from '../lib/social/metaApi'

async function main() {
  const account = await prisma.socialMediaAccount.findFirst({
    where: { platform: 'FACEBOOK', isActive: true, NOT: { accountId: { startsWith: 'dryrun_' } } },
  })
  if (!account) {
    console.log('Aktif Facebook OAuth hesabı yok')
    return
  }

  const cfg =
    account.config && typeof account.config === 'object'
      ? (account.config as Record<string, unknown>)
      : {}

  console.log('=== Facebook account ===')
  console.log({
    name: account.accountName,
    pageId: cfg.pageId,
    metaAppId: cfg.metaAppId || metaAppId(),
    connectConfigId: metaLoginConfigId(),
    publishConfigId: metaLoginConfigIdPublish(),
    oauthConfigIdUsed: metaOAuthConfigId(),
    storedOAuthConfigId: cfg.oauthConfigId,
    META_OAUTH_PUBLISH: process.env.META_OAUTH_PUBLISH || '(not set — set true on Vercel)',
    META_PAGE_ID: process.env.META_PAGE_ID || '(not set — recommend 1153725161168373)',
  })

  const userToken = await getValidAccessToken(account)
  const appId = metaAppId()
  const appSecret = metaAppSecret()
  if (!appId || !appSecret) {
    console.log('META_APP_ID / META_APP_SECRET eksik')
    return
  }

  const debugUrl = new URL(`https://graph.facebook.com/${metaGraphVersion()}/debug_token`)
  debugUrl.searchParams.set('input_token', userToken)
  debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`)
  const debugRes = await fetch(debugUrl)
  const debugBody = await debugRes.text()
  console.log('\n=== Token debug ===')
  if (!debugRes.ok) {
    console.log(debugRes.status, debugBody.slice(0, 400))
    return
  }

  const debug = JSON.parse(debugBody) as {
    data?: { scopes?: string[]; is_valid?: boolean; expires_at?: number }
  }
  const scopes = debug.data?.scopes || []
  console.log({ valid: debug.data?.is_valid, scopes })

  const needed = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list']
  const missing = needed.filter((s) => !scopes.includes(s))
  if (missing.length) {
    console.log('\n⚠ Eksik scope:', missing.join(', '))
    console.log(
      'Çözüm: Vercel env → META_OAUTH_PUBLISH=true, META_LOGIN_CONFIG_ID_PUBLISH=919581157862599, ' +
        'META_PAGE_ID=1153725161168373 → deploy → Sosyal → Kes → OAuth bağla',
    )
  } else {
    console.log('\n✓ Gerekli sayfa scope\'ları token\'da mevcut')
  }
  console.log('\n=== Data access renewal ===')
  console.log('Due 2026-10-07 — Meta Developers → Required actions (separate from App Review submit)')
  console.log('Docs: docs/META_APP_REVIEW_SUBMISSION.md')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
