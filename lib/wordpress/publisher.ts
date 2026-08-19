import type { WpContentPayload, WpPublishResult } from './types'

function wpConfig() {
  const baseUrl = (process.env.WP_BASE_URL || '').replace(/\/$/, '')
  const apiKey = process.env.CONNECT_STUDIO_API_KEY?.trim() || ''
  const username = process.env.WP_USERNAME?.trim() || ''
  const appPassword = process.env.WP_APP_PASSWORD?.trim() || ''
  return { baseUrl, apiKey, username, appPassword }
}

export function wordpressConfigured(): boolean {
  const { baseUrl, apiKey } = wpConfig()
  return Boolean(baseUrl && apiKey)
}

function excerptFromHtml(html: string, n = 157): string {
  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length <= n ? plain : `${plain.slice(0, n)}...`
}

/**
 * Send draft to wp-seo-hub unified ingest (CS-WP-01).
 * Always draft — never publish from Content Studio.
 */
export async function sendDraftToWordPress(payload: WpContentPayload): Promise<WpPublishResult> {
  const { baseUrl, apiKey } = wpConfig()
  if (!baseUrl || !apiKey) {
    return {
      success: false,
      errorMessage: 'WP_BASE_URL veya CONNECT_STUDIO_API_KEY eksik',
    }
  }

  const body = {
    title: payload.title,
    content: payload.content,
    excerpt: payload.excerpt || excerptFromHtml(payload.content),
    post_type: payload.post_type,
    meta: payload.meta || {},
    acf: payload.acf || {},
  }

  const endpoint = `${baseUrl}/wp-json/egitimtoday/v1/publish`

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      post_id?: number
      edit_link?: string
      message?: string
      error?: string
    }

    if (!res.ok) {
      return {
        success: false,
        errorMessage: data.error || `WordPress HTTP ${res.status}`,
      }
    }

    return {
      success: true,
      wpPostId: data.post_id,
      editLink: data.edit_link,
      message: data.message || 'Draft kaydedildi',
    }
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function sendViaCoreRest(
  payload: WpContentPayload,
  options: { status?: 'draft' | 'publish'; slug?: string } = {},
): Promise<WpPublishResult> {
  const { baseUrl, username, appPassword } = wpConfig()
  if (!baseUrl || !username || !appPassword) {
    return { success: false, errorMessage: 'WP_USERNAME / WP_APP_PASSWORD eksik (core REST)' }
  }

  const typeMap: Record<string, string> = {
    article: 'posts',
    podcast: 'podcast',
    anthem: 'anthem',
    video: 'video',
  }
  const restBase = typeMap[payload.post_type] || 'posts'
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64')

  try {
    const res = await fetch(`${baseUrl}/wp-json/wp/v2/${restBase}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title: payload.title,
        content: payload.content,
        excerpt: payload.excerpt || excerptFromHtml(payload.content),
        status: options.status || 'draft',
        ...(options.slug ? { slug: options.slug } : {}),
        meta: {
          _is_ai_generated: options.status === 'publish' ? 'no' : 'yes',
          _safe_samurai_approved: options.status === 'publish' ? 'yes' : 'no',
        },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: number; link?: string; message?: string }
    if (!res.ok) {
      return { success: false, errorMessage: data.message || `HTTP ${res.status}` }
    }
    return {
      success: true,
      wpPostId: data.id,
      editLink: data.id ? `${baseUrl}/wp-admin/post.php?post=${data.id}&action=edit` : undefined,
      message: `${options.status || 'draft'} (core REST)`,
    }
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Fallback if custom ingest route is down. Always draft. */
export async function sendDraftViaCoreRest(payload: WpContentPayload): Promise<WpPublishResult> {
  return sendViaCoreRest(payload, { status: 'draft' })
}
