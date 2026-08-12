import type { SocialPlatform } from '@prisma/client'

const DEFAULT_GRAPH_VERSION = 'v21.0'

export function metaGraphVersion(): string {
  return process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION
}

export function metaAppId(): string | undefined {
  return (
    process.env.META_APP_ID?.trim() ||
    process.env.FACEBOOK_CLIENT_ID?.trim() ||
    process.env.INSTAGRAM_CLIENT_ID?.trim()
  )
}

export function metaAppSecret(): string | undefined {
  return (
    process.env.META_APP_SECRET?.trim() ||
    process.env.FACEBOOK_CLIENT_SECRET?.trim() ||
    process.env.INSTAGRAM_CLIENT_SECRET?.trim()
  )
}

export function metaConfigured(): boolean {
  return Boolean(metaAppId() && metaAppSecret())
}

export function metaCallbackUrl(platform: 'FACEBOOK' | 'INSTAGRAM', appUrl?: string): string {
  const base = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
  if (platform === 'FACEBOOK') {
    return process.env.FACEBOOK_CALLBACK_URL?.trim() || `${base}/api/social/callback/facebook`
  }
  return process.env.INSTAGRAM_CALLBACK_URL?.trim() || `${base}/api/social/callback/instagram`
}

export function metaLoginConfigId(): string | undefined {
  return process.env.META_LOGIN_CONFIG_ID?.trim() || process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim()
}

/** Login Configuration for publish OAuth (pages_manage_posts). Used when META_OAUTH_PUBLISH=true. */
export function metaLoginConfigIdPublish(): string | undefined {
  return (
    process.env.META_LOGIN_CONFIG_ID_PUBLISH?.trim() ||
    process.env.META_PUBLISH_CONFIG_ID?.trim()
  )
}

/** config_id for the next OAuth dialog — publish config when META_OAUTH_PUBLISH=true. */
export function metaOAuthConfigId(): string | undefined {
  if (process.env.META_OAUTH_PUBLISH === 'true') {
    return metaLoginConfigIdPublish() || metaLoginConfigId()
  }
  return metaLoginConfigId()
}

/** Scopes when not using Facebook Login for Business config_id. */
export function metaOAuthConnectScopes(): string {
  if (process.env.META_OAUTH_SCOPES?.trim()) return process.env.META_OAUTH_SCOPES.trim()
  // Business apps need ≥1 business permission beyond email/public_profile
  return ['public_profile', 'email', 'pages_show_list'].join(',')
}

/** Full publish scopes — enable in Meta App Review first, then set META_OAUTH_SCOPES in .env */
export function metaOAuthPublishScopes(): string {
  return [
    ...metaOAuthConnectScopes().split(','),
    'pages_manage_posts',
    'instagram_content_publish',
  ]
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .join(',')
}

export function metaOAuthScopes(): string {
  if (process.env.META_OAUTH_PUBLISH === 'true') {
    return metaOAuthPublishScopes()
  }
  return metaOAuthConnectScopes()
}

/** Actionable Meta Graph error text (pages_manage_posts, video, etc.). */
export function parseMetaApiError(status: number, body: string, context = 'Meta'): string {
  let message = body
  try {
    const j = JSON.parse(body) as { error?: { message?: string; code?: number } }
    message = j.error?.message || body
    if (message.includes('pages_manage_posts')) {
      return (
        `Facebook pages_manage_posts izni yok (${status}). ` +
        'Vercel: META_OAUTH_PUBLISH=true + META_LOGIN_CONFIG_ID_PUBLISH=919581157862599 → ' +
        'Sosyal → Facebook → Kes → OAuth bağla (yayın config ile yeniden yetkilendir).'
      )
    }
    if (/belirli bir süre|spam|ne sıklıkta/i.test(message)) {
      return (
        `Facebook hız/spam limiti (${status}). ` +
        'Kısa sürede çok post atıldı — 30–60 dk bekleyip tekrar deneyin (batch arası otomatik yavaşlatıldı).'
      )
    }
    if (message.includes('No permission to publish the video')) {
      return (
        `Facebook video yayını izni yok (${status}). ` +
        'pages_manage_posts onayı ve sayfa token yenilemesi gerekir.'
      )
    }
  } catch {
    /* raw body */
  }
  return `${context} ${status}: ${message.slice(0, 280)}`
}

export function metaAuthUrl(platform: 'FACEBOOK' | 'INSTAGRAM', state: string, appUrl?: string): string {
  const clientId = metaAppId()
  if (!clientId) throw new Error('META_APP_ID eksik')
  const redirect = metaCallbackUrl(platform, appUrl)
  const configId = metaOAuthConfigId()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    state,
    response_type: 'code',
  })

  // Facebook Login for Business: config_id replaces scope (Meta requires ≥1 business permission)
  if (configId) {
    params.set('config_id', configId)
  } else {
    params.set('scope', metaOAuthScopes())
  }

  return `https://www.facebook.com/${metaGraphVersion()}/dialog/oauth?${params}`
}

type MetaTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
}

type MetaPage = {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string }
}

type MetaIgAccount = {
  id: string
  username?: string
  name?: string
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Meta Graph ${path} ${res.status}: ${body.slice(0, 400)}`)
  }
  return res.json() as Promise<T>
}

export async function exchangeMetaCode(
  code: string,
  redirectUri: string,
): Promise<MetaTokenResponse> {
  const clientId = metaAppId()
  const clientSecret = metaAppSecret()
  if (!clientId || !clientSecret) throw new Error('META_APP_ID / META_APP_SECRET eksik')

  return graphGet<MetaTokenResponse>('oauth/access_token', {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  })
}

export async function exchangeMetaLongLivedToken(shortToken: string): Promise<MetaTokenResponse> {
  const clientId = metaAppId()
  const clientSecret = metaAppSecret()
  if (!clientId || !clientSecret) throw new Error('META_APP_ID / META_APP_SECRET eksik')

  return graphGet<MetaTokenResponse>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortToken,
  })
}

export async function fetchMetaPages(userToken: string): Promise<MetaPage[]> {
  const json = await graphGet<{ data?: MetaPage[] }>('me/accounts', {
    fields: 'id,name,access_token,instagram_business_account',
    access_token: userToken,
  })
  return json.data || []
}

/** Page token when me/accounts unavailable (publish-only OAuth config). */
export async function fetchPageAccessToken(userToken: string, pageId: string): Promise<string> {
  const json = await graphGet<{ access_token?: string; name?: string }>(pageId, {
    fields: 'access_token,name',
    access_token: userToken,
  })
  if (!json.access_token) {
    throw new Error(
      `Sayfa ${pageId} token alınamadı — META_PAGE_ID doğru mu? OAuth pages_manage_posts config ile yeniden bağlayın.`,
    )
  }
  return json.access_token
}

export async function fetchInstagramAccount(
  igUserId: string,
  pageToken: string,
): Promise<MetaIgAccount> {
  return graphGet<MetaIgAccount>(igUserId, {
    fields: 'id,username,name',
    access_token: pageToken,
  })
}

function pickPage(pages: MetaPage[], preferredPageId?: string): MetaPage | undefined {
  if (!pages.length) return undefined
  if (preferredPageId) {
    const match = pages.find((p) => p.id === preferredPageId)
    if (match) return match
  }
  return pages[0]
}

export type MetaOAuthConnectResult = {
  platform: SocialPlatform
  accountId: string
  accountName: string
  pageAccessToken: string
  longLivedUserToken: string
  tokenExpiry?: Date
  config: Record<string, unknown>
}

export async function connectMetaPlatform(
  platform: 'FACEBOOK' | 'INSTAGRAM',
  code: string,
): Promise<MetaOAuthConnectResult> {
  const redirect = metaCallbackUrl(platform)
  const short = await exchangeMetaCode(code, redirect)
  const long = await exchangeMetaLongLivedToken(short.access_token)
  const pages = await fetchMetaPages(long.access_token)

  if (!pages.length) {
    throw new Error(
      'Facebook sayfası bulunamadı — business.facebook.com üzerinden en az bir sayfa oluşturun ve admin olun',
    )
  }

  const preferredPageId = process.env.META_PAGE_ID?.trim()
  const tokenExpiry = long.expires_in
    ? new Date(Date.now() + long.expires_in * 1000)
    : new Date(Date.now() + 55 * 24 * 60 * 60 * 1000)

  if (platform === 'FACEBOOK') {
    let page = pickPage(pages, preferredPageId)
    if (!page?.access_token && preferredPageId) {
      const pageToken = await fetchPageAccessToken(long.access_token, preferredPageId)
      page = { id: preferredPageId, name: 'Egitim.today', access_token: pageToken }
    }
    if (!page?.access_token) throw new Error('Sayfa access token alınamadı')
    return {
      platform: 'FACEBOOK',
      accountId: page.id,
      accountName: page.name,
      pageAccessToken: page.access_token,
      longLivedUserToken: long.access_token,
      tokenExpiry,
      config: {
        oauth: true,
        pageId: page.id,
        pageName: page.name,
        metaAppId: metaAppId(),
        oauthConfigId: metaOAuthConfigId(),
      },
    }
  }

  const pageWithIg =
    pages.find((p) => p.instagram_business_account?.id && (!preferredPageId || p.id === preferredPageId)) ||
    pages.find((p) => p.instagram_business_account?.id)

  if (!pageWithIg?.instagram_business_account?.id || !pageWithIg.access_token) {
    throw new Error(
      'Instagram Business hesabı bulunamadı — IG hesabını Facebook sayfasına bağlayın (Profesyonel hesap gerekli)',
    )
  }

  const ig = await fetchInstagramAccount(
    pageWithIg.instagram_business_account.id,
    pageWithIg.access_token,
  )

  return {
    platform: 'INSTAGRAM',
    accountId: ig.id,
    accountName: ig.username ? `@${ig.username}` : ig.name || 'Instagram',
    pageAccessToken: pageWithIg.access_token,
    longLivedUserToken: long.access_token,
    tokenExpiry,
    config: {
      oauth: true,
      igUserId: ig.id,
      username: ig.username,
      pageId: pageWithIg.id,
      pageName: pageWithIg.name,
      metaAppId: metaAppId(),
    },
  }
}

export type MetaTestResult = {
  ok: boolean
  pageName?: string
  igUsername?: string
  error?: string
}

export async function testMetaConnection(
  platform: SocialPlatform,
  accessToken: string,
  config: unknown,
): Promise<MetaTestResult> {
  try {
    const cfg =
      config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
    if (platform === 'FACEBOOK') {
      const pageId = String(cfg.pageId || '')
      const json = await graphGet<{ name?: string }>(pageId, {
        fields: 'name,id',
        access_token: accessToken,
      })
      return { ok: true, pageName: json.name }
    }
    if (platform === 'INSTAGRAM') {
      const igId = String(cfg.igUserId || '')
      const json = await graphGet<{ username?: string }>(igId, {
        fields: 'username,name',
        access_token: accessToken,
      })
      return { ok: true, igUsername: json.username }
    }
    return { ok: false, error: 'Desteklenmeyen platform' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function refreshMetaLongLivedToken(currentToken: string): Promise<MetaTokenResponse | null> {
  try {
    return await exchangeMetaLongLivedToken(currentToken)
  } catch (err) {
    console.error('[metaApi] token refresh failed', err)
    return null
  }
}
