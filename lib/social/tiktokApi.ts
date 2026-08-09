const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

export function tiktokClientKey(): string | undefined {
  return process.env.TIKTOK_CLIENT_KEY?.trim()
}

export function tiktokClientSecret(): string | undefined {
  return process.env.TIKTOK_CLIENT_SECRET?.trim()
}

export function tiktokConfigured(): boolean {
  return Boolean(tiktokClientKey() && tiktokClientSecret())
}

export function tiktokCallbackUrl(appUrl?: string): string {
  const base = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
  return process.env.TIKTOK_CALLBACK_URL?.trim() || `${base}/api/social/callback/tiktok`
}

/** video.publish requires app audit approval; video.upload (draft/inbox) works unaudited. */
export function tiktokOAuthScopes(): string {
  if (process.env.TIKTOK_OAUTH_SCOPES?.trim()) return process.env.TIKTOK_OAUTH_SCOPES.trim()
  const scopes = ['user.info.basic']
  scopes.push(process.env.TIKTOK_AUDITED === 'true' ? 'video.publish' : 'video.upload')
  return scopes.join(',')
}

export function tiktokAuthUrl(state: string, appUrl?: string): string {
  const clientKey = tiktokClientKey()
  if (!clientKey) throw new Error('TIKTOK_CLIENT_KEY eksik')
  const params = new URLSearchParams({
    client_key: clientKey,
    scope: tiktokOAuthScopes(),
    response_type: 'code',
    redirect_uri: tiktokCallbackUrl(appUrl),
    state,
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`
}

type TikTokTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  open_id: string
  error?: string
  error_description?: string
}

export async function exchangeTikTokCode(code: string, redirectUri: string): Promise<TikTokTokenResponse> {
  const clientKey = tiktokClientKey()
  const clientSecret = tiktokClientSecret()
  if (!clientKey || !clientSecret) throw new Error('TikTok client credentials eksik')

  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  const json = (await res.json()) as TikTokTokenResponse
  if (!res.ok || json.error) {
    throw new Error(`TikTok token ${res.status}: ${json.error_description || JSON.stringify(json)}`)
  }
  return json
}

export async function refreshTikTokToken(refreshToken: string): Promise<TikTokTokenResponse | null> {
  const clientKey = tiktokClientKey()
  const clientSecret = tiktokClientSecret()
  if (!clientKey || !clientSecret) return null

  const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    console.error('[tiktokApi] refresh failed', res.status, await res.text())
    return null
  }
  return res.json() as Promise<TikTokTokenResponse>
}

type TikTokUserInfo = {
  open_id: string
  display_name?: string
  avatar_url?: string
}

export async function fetchTikTokUser(accessToken: string): Promise<TikTokUserInfo> {
  const res = await fetch(
    `${TIKTOK_API_BASE}/user/info/?fields=open_id,display_name,avatar_url`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const json = (await res.json()) as { data?: { user?: TikTokUserInfo }; error?: { message?: string } }
  if (!res.ok || json.error) {
    throw new Error(`TikTok user info ${res.status}: ${json.error?.message || 'unknown'}`)
  }
  if (!json.data?.user?.open_id) throw new Error('TikTok user bilgisi alınamadı')
  return json.data.user
}

export type TikTokUploadResult = { publishId: string; isDraft: boolean }

/** Direct-post video upload — audited apps go straight to public feed (isDraft=false);
 * unaudited apps land in the user's TikTok inbox as a private draft they must confirm. */
export async function uploadTikTokVideo(
  accessToken: string,
  videoBuffer: Buffer,
  caption: string,
): Promise<TikTokUploadResult> {
  const audited = process.env.TIKTOK_AUDITED === 'true'
  const privacyLevel = audited
    ? process.env.TIKTOK_PRIVACY_LEVEL?.trim() || 'PUBLIC_TO_EVERYONE'
    : 'SELF_ONLY'

  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoBuffer.length,
        chunk_size: videoBuffer.length,
        total_chunk_count: 1,
      },
    }),
  })
  const initJson = (await initRes.json()) as {
    data?: { publish_id?: string; upload_url?: string }
    error?: { code?: string; message?: string }
  }
  if (!initRes.ok || initJson.error?.code === 'error' || !initJson.data?.upload_url) {
    throw new Error(`TikTok init ${initRes.status}: ${initJson.error?.message || JSON.stringify(initJson)}`)
  }

  const uploadRes = await fetch(initJson.data.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
    },
    body: new Uint8Array(videoBuffer),
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    throw new Error(`TikTok upload ${uploadRes.status}: ${body.slice(0, 300)}`)
  }

  if (!initJson.data.publish_id) throw new Error('TikTok publish_id alınamadı')
  return { publishId: initJson.data.publish_id, isDraft: !audited }
}