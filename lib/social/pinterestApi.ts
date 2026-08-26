const PINTEREST_API_BASE = 'https://api.pinterest.com/v5'
const PINTEREST_AUTH_URL = 'https://www.pinterest.com/oauth/'

export function pinterestAppId(): string | undefined {
  return process.env.PINTEREST_APP_ID?.trim() || process.env.PINTEREST_CLIENT_ID?.trim()
}

export function pinterestAppSecret(): string | undefined {
  return process.env.PINTEREST_APP_SECRET?.trim() || process.env.PINTEREST_CLIENT_SECRET?.trim()
}

export function pinterestConfigured(): boolean {
  return Boolean(pinterestAppId() && pinterestAppSecret())
}

export function pinterestCallbackUrl(appUrl?: string): string {
  const base = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
  return process.env.PINTEREST_CALLBACK_URL?.trim() || `${base.replace(/\/$/, '')}/api/social/callback/pinterest`
}

/** boards:write required when callback auto-creates an egitim.today board. */
export function pinterestOAuthScopes(): string {
  return (
    process.env.PINTEREST_OAUTH_SCOPES?.trim() ||
    'boards:read,boards:write,pins:read,pins:write,user_accounts:read'
  )
}

export function pinterestAuthUrl(state: string, appUrl?: string): string {
  const clientId = pinterestAppId()
  if (!clientId) throw new Error('PINTEREST_APP_ID eksik')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: pinterestCallbackUrl(appUrl),
    response_type: 'code',
    scope: pinterestOAuthScopes(),
    state,
  })
  return `${PINTEREST_AUTH_URL}?${params}`
}

type PinterestTokenResponse = {
  access_token: string
  refresh_token?: string
  token_type?: string
  /** Access token expiry in seconds (~30 days). Continuous refresh is refreshable if used within ~60 days. */
  expires_in?: number
  scope?: string
}

async function pinterestFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PINTEREST_API_BASE}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Pinterest API ${path} ${res.status}: ${body.slice(0, 400)}`)
  }
  return res.json() as Promise<T>
}

function basicAuthHeader(): string {
  const clientId = pinterestAppId()
  const clientSecret = pinterestAppSecret()
  if (!clientId || !clientSecret) throw new Error('PINTEREST_APP_ID / PINTEREST_APP_SECRET eksik')
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export async function exchangePinterestCode(
  code: string,
  redirectUri: string,
): Promise<PinterestTokenResponse> {
  return pinterestFetch<PinterestTokenResponse>('/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      // Legacy apps (pre-2025-09-25); ignored/auto for newer apps.
      continuous_refresh: 'true',
    }),
  })
}

export async function refreshPinterestToken(
  refreshToken: string,
): Promise<PinterestTokenResponse | null> {
  if (!pinterestConfigured()) return null
  try {
    return await pinterestFetch<PinterestTokenResponse>('/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuthHeader()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
  } catch (err) {
    console.error('[pinterestApi] token refresh failed', err)
    return null
  }
}

export type PinterestUserAccount = {
  id?: string
  username?: string
  account_type?: string
}

export async function fetchPinterestUserAccount(accessToken: string): Promise<PinterestUserAccount> {
  return pinterestFetch<PinterestUserAccount>('/user_account', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export type PinterestBoard = { id: string; name: string }

export async function fetchPinterestBoards(accessToken: string): Promise<PinterestBoard[]> {
  const json = await pinterestFetch<{ items?: PinterestBoard[] }>('/boards', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return json.items || []
}

export async function createPinterestBoard(
  accessToken: string,
  name: string,
  description?: string,
): Promise<PinterestBoard> {
  return pinterestFetch<PinterestBoard>('/boards', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description, privacy: 'PUBLIC' }),
  })
}

export type PinterestPublishResult = { platformPostId: string }

/** Pins need an existing board and a publicly reachable image URL. */
export async function publishPinterestPin(
  accessToken: string,
  boardId: string,
  opts: { title?: string; description?: string; link?: string; imageUrl: string },
): Promise<PinterestPublishResult> {
  const json = await pinterestFetch<{ id: string }>('/pins', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      board_id: boardId,
      title: opts.title?.slice(0, 100),
      description: opts.description?.slice(0, 800),
      link: opts.link,
      media_source: { source_type: 'image_url', url: opts.imageUrl },
    }),
  })
  return { platformPostId: json.id }
}
