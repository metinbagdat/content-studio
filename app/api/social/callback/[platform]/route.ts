import { NextRequest, NextResponse } from 'next/server'
import { upsertDryRunAccount, upsertOAuthAccount } from '@/lib/social/oauth'

export const dynamic = 'force-dynamic'

/** OAuth callback stub — exchanges code when credentials present; else dry-run. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform: raw } = await ctx.params
  const platform = raw.toLowerCase() === 'twitter' ? 'TWITTER' : 'LINKEDIN'
  const code = req.nextUrl.searchParams.get('code')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'

  if (!code) {
    await upsertDryRunAccount(platform, `Dry-run ${platform}`)
    return NextResponse.redirect(`${appUrl}/admin/social?connected=dry`)
  }

  try {
    if (platform === 'TWITTER' && process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET) {
      const redirect = process.env.X_CALLBACK_URL || `${appUrl}/api/social/callback/twitter`
      const basic = Buffer.from(
        `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`,
      ).toString('base64')
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirect,
          code_verifier: 'challenge',
        }),
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
        accountName: me.data?.username || me.data?.name || 'X account',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
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
      await upsertOAuthAccount({
        platform: 'LINKEDIN',
        accountId: me.sub || `li_${Date.now()}`,
        accountName: me.name || 'LinkedIn',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
      })
    } else {
      await upsertDryRunAccount(platform, `Dry-run ${platform}`)
    }
  } catch (err) {
    console.error('[oauth callback]', err)
    await upsertDryRunAccount(platform, `Dry-run fallback ${platform}`)
    return NextResponse.redirect(`${appUrl}/admin/social?connected=error`)
  }

  return NextResponse.redirect(`${appUrl}/admin/social?connected=1`)
}
