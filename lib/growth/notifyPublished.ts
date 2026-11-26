/** LearnCon Growth OS: mark a brief published after WP ingest succeeds. */

export const DEFAULT_GROWTH_CONTENT_WEBHOOK_URL =
  'https://www.egitim.today/api/growth/content-published'

const DEFAULT_TIMEOUT_MS = 5000
const LC_HUB = 'https://blog.egitim.today'
const LC_ARTICLE_BASE = '/yazilar'
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type GrowthNotifyInput = {
  publishedUrl?: string | null
  csSourceId?: string | null
  briefId?: string | null
  platform?: string | null
  link?: string | null
  slug?: string | null
}

export type GrowthNotifyResult = {
  ok: boolean
  skipped: boolean
  reason?: string
  status?: number
}

export type GrowthNotifyOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
  fetch?: typeof fetch
  timeoutMs?: number
  logger?: { warn?: (...args: unknown[]) => void }
}

export function getGrowthContentWebhookConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const url = String(env.GROWTH_CONTENT_WEBHOOK_URL || '').trim() || DEFAULT_GROWTH_CONTENT_WEBHOOK_URL
  const secret = String(env.GROWTH_CONTENT_WEBHOOK_SECRET || '').trim()
  return {
    url,
    secret,
    configured: Boolean(url && secret),
  }
}

/** Map a CMS or LC permalink to the public Learning Center article URL (no trailing slash). */
export function publicLearningCenterArticleUrl(raw: string | null | undefined, slug?: string | null): string | null {
  const fromSlug = String(slug || '').trim().replace(/\/+$/, '').toLowerCase()
  if (fromSlug && SLUG_RE.test(fromSlug)) {
    return `${LC_HUB}${LC_ARTICLE_BASE}/${fromSlug}`
  }
  const value = String(raw || '').trim()
  if (!value) return null
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname.replace(/\/+$/, '')
    const yazilar = path.match(/^\/yazilar\/([^/]+)$/)
    if (host === 'blog.egitim.today' && yazilar && SLUG_RE.test(yazilar[1])) {
      return `${LC_HUB}${LC_ARTICLE_BASE}/${yazilar[1]}`
    }
    const bare = path.match(/^\/([^/]+)$/)
    if ((host === 'wp.egitim.today' || host === 'blog.egitim.today') && bare && SLUG_RE.test(bare[1])) {
      return `${LC_HUB}${LC_ARTICLE_BASE}/${bare[1]}`
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch {
    return null
  }
  return null
}

function slugFromLink(raw: string | null | undefined): string | null {
  try {
    const path = new URL(String(raw || '')).pathname.replace(/\/+$/, '')
    const parts = path.split('/').filter(Boolean)
    const last = parts[parts.length - 1] || ''
    return SLUG_RE.test(last) ? last : null
  } catch {
    return null
  }
}

/**
 * POST LearnCon /api/growth/content-published.
 * Env-gated: requires GROWTH_CONTENT_WEBHOOK_SECRET (URL defaults to prod).
 * Never throws. Does not log the secret.
 */
export async function notifyLearnconContentPublished(
  input: GrowthNotifyInput,
  options: GrowthNotifyOptions = {},
): Promise<GrowthNotifyResult> {
  const env = options.env || process.env
  const config = getGrowthContentWebhookConfig(env)
  if (!config.secret) {
    return { ok: true, skipped: true, reason: 'not_configured' }
  }

  const slug = String(input.slug || '').trim() || slugFromLink(input.publishedUrl || input.link)
  const publishedUrl = publicLearningCenterArticleUrl(input.publishedUrl || input.link, slug)
  const csSourceId = String(input.csSourceId || '').trim()
  const briefId = String(input.briefId || '').trim()
  if (!publishedUrl) {
    return { ok: true, skipped: true, reason: 'missing_published_url' }
  }
  if (!briefId && !csSourceId) {
    return { ok: true, skipped: true, reason: 'missing_cs_source_id' }
  }

  const fetchFn = options.fetch || globalThis.fetch
  if (typeof fetchFn !== 'function') {
    return { ok: false, skipped: false, reason: 'fetch_unavailable' }
  }

  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  const body: Record<string, string> = {
    published_url: publishedUrl,
    platform: String(input.platform || 'wordpress'),
  }
  if (csSourceId) body.cs_source_id = csSourceId
  if (briefId) body.brief_id = briefId

  try {
    const res = await fetchFn(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-growth-webhook-secret': config.secret,
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    })
    return {
      ok: Boolean(res.ok),
      skipped: false,
      status: res.status,
      reason: res.ok ? undefined : 'http_error',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'notify_failed'
    const timedOut = /abort/i.test(message)
    return { ok: false, skipped: false, reason: timedOut ? 'timeout' : 'network_error' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Fire-and-forget wrapper so WP ingest never waits on LearnCon. */
export function scheduleLearnconGrowthNotify(
  input: GrowthNotifyInput,
  options: GrowthNotifyOptions = {},
): void {
  const logger = options.logger || console
  void notifyLearnconContentPublished(input, options)
    .then((result) => {
      if (result.skipped || result.ok) return
      logger.warn?.('[growth-webhook]', result.reason || result.status || 'failed')
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'notify_failed'
      logger.warn?.('[growth-webhook]', message)
    })
}
