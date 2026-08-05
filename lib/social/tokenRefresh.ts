import type { SocialMediaAccount } from '@prisma/client'
import { prisma } from '../prisma'
import { decryptSecret, encryptSecret } from '../crypto'

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
