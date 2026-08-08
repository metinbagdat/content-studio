import { SocialPlatform, type Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { encryptSecret } from '../crypto'
import { linkedinOAuthScopes, youtubeOAuthScopes } from './config'
import { metaConfigured, metaAuthUrl } from './metaApi'

export type OAuthConnectPlatform = 'TWITTER' | 'LINKEDIN' | 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM'

/**
 * OAuth helpers for X + LinkedIn + YouTube.
 * Without client credentials, connectAccount stores a dry-run account for local testing.
 */

export function getAuthUrl(
  platform: OAuthConnectPlatform,
  state: string,
  codeChallenge?: string,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
  if (platform === 'TWITTER') {
    const clientId = process.env.X_CLIENT_ID
    const redirect = process.env.X_CALLBACK_URL || `${appUrl}/api/social/callback/twitter`
    if (!clientId) return `${appUrl}/admin/social?dryRun=twitter&state=${state}`
    const challenge = codeChallenge || 'challenge'
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirect,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: challenge,
      code_challenge_method: codeChallenge ? 'S256' : 'plain',
    })
    return `https://twitter.com/i/oauth2/authorize?${params}`
  }

  if (platform === 'LINKEDIN') {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const redirect = process.env.LINKEDIN_CALLBACK_URL || `${appUrl}/api/social/callback/linkedin`
    if (!clientId) return `${appUrl}/admin/social?dryRun=linkedin&state=${state}`
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirect,
      state,
      scope: linkedinOAuthScopes(),
    })
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`
  }

  if (platform === 'YOUTUBE') {
    const clientId = process.env.YOUTUBE_CLIENT_ID
    const redirect = process.env.YOUTUBE_CALLBACK_URL || `${appUrl}/api/social/callback/youtube`
    if (!clientId) return `${appUrl}/admin/social?dryRun=youtube&state=${state}`
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirect,
      scope: youtubeOAuthScopes(),
      state,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
    if (!metaConfigured()) {
      return `${appUrl}/admin/social?dryRun=${platform.toLowerCase()}&state=${state}`
    }
    return metaAuthUrl(platform, state, appUrl)
  }

  return `${appUrl}/admin/social?connected=error&reason=unsupported_platform`
}

export async function upsertDryRunAccount(platform: SocialPlatform, name: string) {
  return prisma.socialMediaAccount.upsert({
    where: {
      platform_accountId: { platform, accountId: `dryrun_${platform.toLowerCase()}` },
    },
    update: {
      accountName: name,
      accessToken: encryptSecret('dry-run'),
      isActive: true,
    },
    create: {
      platform,
      accountName: name,
      accountId: `dryrun_${platform.toLowerCase()}`,
      accessToken: encryptSecret('dry-run'),
      isActive: true,
      config: { dryRun: true },
    },
  })
}

export async function upsertOAuthAccount(opts: {
  platform: SocialPlatform
  accountId: string
  accountName: string
  accessToken: string
  refreshToken?: string
  tokenExpiry?: Date
  config?: Prisma.InputJsonValue
}) {
  return prisma.socialMediaAccount.upsert({
    where: {
      platform_accountId: { platform: opts.platform, accountId: opts.accountId },
    },
    update: {
      accountName: opts.accountName,
      accessToken: encryptSecret(opts.accessToken),
      refreshToken: opts.refreshToken ? encryptSecret(opts.refreshToken) : undefined,
      tokenExpiry: opts.tokenExpiry,
      isActive: true,
      config: opts.config,
    },
    create: {
      platform: opts.platform,
      accountName: opts.accountName,
      accountId: opts.accountId,
      accessToken: encryptSecret(opts.accessToken),
      refreshToken: opts.refreshToken ? encryptSecret(opts.refreshToken) : undefined,
      tokenExpiry: opts.tokenExpiry,
      isActive: true,
      config: opts.config,
    },
  })
}

export async function deactivateAccount(accountId: string) {
  return prisma.socialMediaAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  })
}
