import type { SocialMediaAccount } from '@prisma/client'
import { prisma } from '../prisma'
import { decryptSecret, encryptSecret } from '../crypto'
import { metaAppId, metaAppSecret } from './metaApi'
export class TokenExpiredError extends Error {
  constructor(platform: string) {
    super(`${platform} OAuth token süresi doldu — /admin/social üzerinden hesabı yeniden bağla`)
    this.name = 'TokenExpiredError'
  }
}

export async function getValidAccessToken(account: SocialMediaAccount): Promise<string> {
  const access = decryptSecret(account.accessToken)
  if (access === 'dry-run') return access

  const stillValid =
    !account.tokenExpiry || account.tokenExpiry.getTime() > Date.now() + 120_000
  if (stillValid) return access

  const refreshed = await refreshAccessToken(account)
  if (refreshed) return refreshed

  await prisma.socialMediaAccount.update({
    where: { id: account.id },
    data: { isActive: false },
  }).catch(() => {})

  throw new TokenExpiredError(account.platform)
}

async function refreshAccessToken(account: SocialMediaAccount): Promise<string | null> {
  if (!account.refreshToken) return null
  const refresh = decryptSecret(account.refreshToken)

  if (account.platform === 'TWITTER' && process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET) {
    const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString(
      'base64',
    )
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
      }),
    })
    if (!res.ok) {
      console.error('[tokenRefresh] X refresh failed', res.status, await res.text())
      return null
    }
    const tokens = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }
    await persistTokens(account.id, tokens.access_token, tokens.refresh_token, tokens.expires_in)
    return tokens.access_token
  }

  if (
    account.platform === 'LINKEDIN' &&
    process.env.LINKEDIN_CLIENT_ID &&
    process.env.LINKEDIN_CLIENT_SECRET
  ) {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    })
    if (!res.ok) {
      console.error('[tokenRefresh] LinkedIn refresh failed', res.status, await res.text())
      return null
    }
    const tokens = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }
    await persistTokens(account.id, tokens.access_token, tokens.refresh_token, tokens.expires_in)
    return tokens.access_token
  }

  if (
    account.platform === 'YOUTUBE' &&
    process.env.YOUTUBE_CLIENT_ID &&
    process.env.YOUTUBE_CLIENT_SECRET
  ) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      }),
    })
    if (!res.ok) {
      console.error('[tokenRefresh] YouTube refresh failed', res.status, await res.text())
      return null
    }
    const tokens = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }
    await persistTokens(account.id, tokens.access_token, tokens.refresh_token, tokens.expires_in)
    return tokens.access_token
  }
  
  if (account.platform === 'TIKTOK' && process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) {
    const { refreshTikTokToken } = await import('./tiktokApi')
    const tokens = await refreshTikTokToken(refresh)
    if (!tokens) return null
    await persistTokens(account.id, tokens.access_token, tokens.refresh_token, tokens.expires_in)
    return tokens.access_token
  }

  if (
    (account.platform === 'FACEBOOK' || account.platform === 'INSTAGRAM') &&
    account.refreshToken &&
    metaAppId() &&
    metaAppSecret()
  ) {
    const { refreshMetaLongLivedToken, fetchMetaPages } = await import('./metaApi')
    const refresh = decryptSecret(account.refreshToken)
    const long = await refreshMetaLongLivedToken(refresh)
    if (!long?.access_token) return null

    const pages = await fetchMetaPages(long.access_token)
    const cfg =
      account.config && typeof account.config === 'object'
        ? (account.config as Record<string, unknown>)
        : {}
    const pageId = String(cfg.pageId || process.env.META_PAGE_ID || '')
    const page = pages.find((p) => p.id === pageId) || pages[0]
    if (!page?.access_token) return null

    await persistTokens(
      account.id,
      page.access_token,
      long.access_token,
      long.expires_in || 55 * 24 * 3600,
    )
    return page.access_token
  }

  return null
}

async function persistTokens(
  accountId: string,
  accessToken: string,
  refreshToken?: string,
  expiresIn?: number,
) {
  await prisma.socialMediaAccount.update({
    where: { id: accountId },
    data: {
      accessToken: encryptSecret(accessToken),
      refreshToken: refreshToken ? encryptSecret(refreshToken) : undefined,
      tokenExpiry: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      isActive: true,
    },
  })
}
