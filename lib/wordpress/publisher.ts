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
    ...(payload.slug ? { slug: payload.slug } : {}),
    ...(payload.wpPostId ? { post_id: payload.wpPostId } : {}),
    ...(payload.categories?.length ? { categories: payload.categories } : {}),
    ...(payload.tags?.length ? { tags: payload.tags } : {}),
    meta: {
      ...(payload.meta || {}),
      // CS Safe Samurai gate passed before send — WP stores on draft for publish webhook.
      _cs_safe_samurai_validated: 'yes',
    },
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
    career_insight: 'career-insight',
  }
  const restBase = typeMap[payload.post_type] || 'posts'
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64')
  const status = options.status || 'draft'

  // Draft from CS after Safe Samurai: AI yes, human WP approval still pending.
  const draftMeta = {
    _is_ai_generated: 'yes',
    _safe_samurai_approved: 'no',
    _cs_safe_samurai_validated: 'yes',
  }

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
        status,
        ...(options.slug ? { slug: options.slug } : {}),
        meta: draftMeta,
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
      message: `${status} (core REST)`,
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

const REST_BASE: Record<string, string> = {
  article: 'posts',
  podcast: 'podcast',
  anthem: 'anthem',
  video: 'video',
  career_insight: 'career-insight',
}

function coreAuth(): { baseUrl: string; auth: string } | null {
  const { baseUrl, username, appPassword } = wpConfig()
  if (!baseUrl || !username || !appPassword) return null
  return { baseUrl, auth: Buffer.from(`${username}:${appPassword}`).toString('base64') }
}

/** Update an existing WP draft (does not publish). */
export async function updateViaCoreRest(
  postId: number,
  payload: WpContentPayload,
  options: { slug?: string; categories?: number[]; tags?: number[] } = {},
): Promise<WpPublishResult> {
  const creds = coreAuth()
  if (!creds) return { success: false, errorMessage: 'WP_USERNAME / WP_APP_PASSWORD eksik (core REST)' }

  const restBase = REST_BASE[payload.post_type] || 'posts'
  let featuredMedia: number | undefined
  try {
    const current = await fetch(`${creds.baseUrl}/wp-json/wp/v2/${restBase}/${postId}?context=edit`, {
      headers: { Authorization: `Basic ${creds.auth}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (current.ok) {
      const cur = (await current.json()) as { featured_media?: number }
      if (cur.featured_media && cur.featured_media > 0) featuredMedia = cur.featured_media
    }
  } catch {
    /* keep going */
  }
  try {
    const res = await fetch(`${creds.baseUrl}/wp-json/wp/v2/${restBase}/${postId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${creds.auth}`,
      },
      body: JSON.stringify({
        title: payload.title,
        content: payload.content,
        excerpt: payload.excerpt || excerptFromHtml(payload.content),
        status: 'draft',
        ...(options.slug || payload.slug ? { slug: options.slug || payload.slug } : {}),
        ...(options.categories?.length ? { categories: options.categories } : {}),
        ...(options.tags?.length ? { tags: options.tags } : {}),
        ...(featuredMedia ? { featured_media: featuredMedia } : {}),
      }),
      signal: AbortSignal.timeout(60_000),
    })
    const data = (await res.json().catch(() => ({}))) as { id?: number; message?: string }
    if (!res.ok) {
      return { success: false, errorMessage: data.message || `HTTP ${res.status}` }
    }
    return {
      success: true,
      wpPostId: data.id || postId,
      editLink: `${creds.baseUrl}/wp-admin/post.php?post=${postId}&action=edit`,
      message: 'draft updated (core REST)',
    }
  } catch (err) {
    return { success: false, errorMessage: err instanceof Error ? err.message : String(err) }
  }
}

export async function ensureWpTerms(
  kind: 'categories' | 'tags',
  slugs: string[],
): Promise<number[]> {
  const creds = coreAuth()
  if (!creds) throw new Error('WP core REST credentials missing')
  const ids: number[] = []
  for (const slug of slugs) {
    const name = slug.replace(/-/g, ' ')
    const lookup = await fetch(
      `${creds.baseUrl}/wp-json/wp/v2/${kind}?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Basic ${creds.auth}` }, signal: AbortSignal.timeout(20_000) },
    )
    const existing = (await lookup.json().catch(() => [])) as { id?: number }[]
    if (existing[0]?.id) {
      ids.push(existing[0].id)
      continue
    }
    const created = await fetch(`${creds.baseUrl}/wp-json/wp/v2/${kind}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${creds.auth}`,
      },
      body: JSON.stringify({ name, slug }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await created.json().catch(() => ({}))) as { id?: number; message?: string }
    if (!created.ok || !data.id) {
      throw new Error(`WP ${kind} ${slug}: ${data.message || created.status}`)
    }
    ids.push(data.id)
  }
  return ids
}

export async function updateRankMathMeta(
  postId: number,
  meta: { focusKeyword: string; title: string; description: string },
): Promise<{ ok: boolean; error?: string }> {
  const creds = coreAuth()
  if (!creds) return { ok: false, error: 'WP credentials missing' }
  try {
    const res = await fetch(`${creds.baseUrl}/wp-json/rankmath/v1/updateMeta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${creds.auth}`,
      },
      body: JSON.stringify({
        objectType: 'post',
        objectID: postId,
        meta: {
          rank_math_focus_keyword: meta.focusKeyword,
          rank_math_title: meta.title,
          rank_math_description: meta.description,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string }
    if (!res.ok) return { ok: false, error: data.message || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
