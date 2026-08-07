import { NextRequest, NextResponse } from 'next/server'
import type { SocialPlatform } from '@prisma/client'
import { upsertDryRunAccount, upsertOAuthAccount } from '@/lib/social/oauth'
import { pkceCookieName } from '@/lib/social/pkce'
import { syncSocialDraftsFromApprovedCaptions } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

const PLATFORM_MAP: Record<string, SocialPlatform> = {
  twitter: 'TWITTER',
  linkedin: 'LINKEDIN',
  youtube: 'YOUTUBE',
}

function redirectWithMessage(appUrl: string, query: string) {
  return NextResponse.redirect(`${appUrl}/admin/social?${query}`)
}

/** OAuth callback — exchanges code when credentials present; else dry-run. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform: raw } = await ctx.params
  const platformKey = raw.toLowerCase()
  const platform = PLATFORM_MAP[platformKey]
  const code = req.nextUrl.searchParams.get('code')
  const oauthError = req.nextUrl.searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'

  if (!platform) {
    return redirectWithMessage(appUrl, `connected=error&reason=${encodeURIComponent('unsupported_platform')}`)
  }

  if (oauthError) {
    return redirectWithMessage(appUrl, `connected=error&reason=${encodeURIComponent(oauthError)}`)
  }

  if (!code) {
    await upsertDryRunAccount(platform, `Dry-run ${platform}`)
    return redirectWithMessage(appUrl, 'connected=dry')
  }

  const pkceVerifier =
    req.cookies.get(pkceCookieName(platformKey as 'twitter' | 'linkedin'))?.value ||
    (platformKey === 'twitter' ? 'challenge' : undefined)

  try {
    if (platform === 'TWITTER' && process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET) {
      const redirect = process.env.X_CALLBACK_URL || `${appUrl}/api/social/callback/twitter`
      const basic = Buffer.from(
        `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`,
      ).toString('base64')
      const tokenBody: Record<string, string> = {
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirect,
      }
      if (pkceVerifier) tokenBody.code_verifier = pkceVerifier

      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenBody),
      })
      if (!tokenRes.ok) throw new Error(await tokenRes.text())
      const tokens = (await tokenRes.json()) as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }
      const meRes = await fetch('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const me = (await meRes.json()) as { data?: { id: string; name: string; username: string } }
      await upsertOAuthAccount({
        platform: 'TWITTER',
        accountId: me.data?.id || `x_${Date.now()}`,
        accountName: me.data?.username ? `@${me.data.username}` : me.data?.name || 'X account',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        config: { oauth: true, username: me.data?.username },
      })
    } else if (
      platform === 'LINKEDIN' &&
      process.env.LINKEDIN_CLIENT_ID &&
      process.env.LINKEDIN_CLIENT_SECRET
    ) {
      const redirect = process.env.LINKEDIN_CALLBACK_URL || `${appUrl}/api/social/callback/linkedin`
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirect,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        }),
      })
      if (!tokenRes.ok) throw new Error(await tokenRes.text())
      const tokens = (await tokenRes.json()) as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }
      const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const me = (await meRes.json()) as { sub?: string; name?: string }
      const orgId = process.env.LINKEDIN_ORGANIZATION_ID
      const useOrgPost = process.env.LINKEDIN_ORG_POST === 'true'
      const memberSub = me.sub || ''
      const authorUrn =
        useOrgPost && orgId
          ? `urn:li:organization:${orgId}`
          : memberSub
            ? `urn:li:person:${memberSub}`
            : undefined
      await upsertOAuthAccount({
        platform: 'LINKEDIN',
        accountId: memberSub || `li_${Date.now()}`,
        accountName: me.name || 'LinkedIn',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        config: {
          oauth: true,
          linkedinMemberSub: memberSub,
          organizationId: orgId || null,
          linkedinAuthorUrn: authorUrn,
        },
      })
    } else if (
      platform === 'YOUTUBE' &&
      process.env.YOUTUBE_CLIENT_ID &&
      process.env.YOUTUBE_CLIENT_SECRET
    ) {
      const redirect = process.env.YOUTUBE_CALLBACK_URL || `${appUrl}/api/social/callback/youtube`
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.YOUTUBE_CLIENT_ID,
          client_secret: process.env.YOUTUBE_CLIENT_SECRET,
          redirect_uri: redirect,
          grant_type: 'authorization_code',
        }),
      })
      if (!tokenRes.ok) throw new Error(await tokenRes.text())
      const tokens = (await tokenRes.json()) as {
        access_token: string
        refresh_token?: string
        expires_in?: number
      }

      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      )
      if (!channelRes.ok) throw new Error(await channelRes.text())
      const channelJson = (await channelRes.json()) as {
        items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string } }>
      }
      const channel = channelJson.items?.[0]
      if (!channel?.id) {
        throw new Error('YouTube kanalı bulunamadı — önce YouTube Studio ile kanal oluşturun')
      }

      await upsertOAuthAccount({
        platform: 'YOUTUBE',
        accountId: channel.id,
        accountName: channel.snippet?.title || channel.snippet?.customUrl || 'YouTube',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        config: {
          oauth: true,
          channelId: channel.id,
          channelTitle: channel.snippet?.title,
          customUrl: channel.snippet?.customUrl,
        },
      })
    } else {
      await upsertDryRunAccount(platform, `Dry-run ${platform}`)
      return redirectWithMessage(appUrl, 'connected=dry')
    }
    if (platform !== 'YOUTUBE') {
      await syncSocialDraftsFromApprovedCaptions({ skipImages: true })
    }
  } catch (err) {
    console.error('[oauth callback]', platform, err)
    const reason = err instanceof Error ? err.message.slice(0, 120) : 'oauth_failed'
    return redirectWithMessage(appUrl, `connected=error&reason=${encodeURIComponent(reason)}`)
  }

  const res = redirectWithMessage(appUrl, 'connected=oauth')
  if (platformKey === 'twitter' || platformKey === 'linkedin') {
    res.cookies.set(pkceCookieName(platformKey), '', { maxAge: 0, path: `/api/social/callback/${platformKey}` })
  }
  return res
}
