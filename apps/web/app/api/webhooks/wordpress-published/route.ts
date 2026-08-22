import { NextRequest, NextResponse } from 'next/server'
import type { WordpressPublishedPayload } from '@/lib/wordpress/ingestPublished'
import { handleWordpressPublishWebhook } from '@/lib/wordpress/publishWebhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Auth for WP → CS publish webhook.
 * Prefer dedicated WP_PUBLISH_WEBHOOK_SECRET (x-wp-webhook-secret).
 * Fallback: CONNECT_STUDIO_API_KEY (X-API-Key) for legacy WP installs.
 * Fail-closed when neither is set.
 */
function isAuthorized(req: NextRequest): boolean {
  const dedicated = (process.env.WP_PUBLISH_WEBHOOK_SECRET || '').trim()
  const legacy = (process.env.CONNECT_STUDIO_API_KEY || '').trim()
  const headerSecret = req.headers.get('x-wp-webhook-secret')?.trim() || ''
  const headerApi =
    req.headers.get('x-api-key')?.trim() ||
    req.headers.get('x-admin-key')?.trim() ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()

  if (dedicated) {
    return headerSecret.length > 0 && headerSecret === dedicated
  }
  if (!legacy) return false
  return (
    (headerApi.length > 0 && headerApi === legacy) ||
    (headerSecret.length > 0 && headerSecret === legacy)
  )
}

function authConfigured(): boolean {
  return Boolean(
    (process.env.WP_PUBLISH_WEBHOOK_SECRET || '').trim() ||
      (process.env.CONNECT_STUDIO_API_KEY || '').trim(),
  )
}

/**
 * WordPress publish → Content Studio SM ingest (CS-WP-04).
 * POST /api/webhooks/wordpress-published
 * Alias:    POST /api/wordpress/webhook
 *
 * No `action` field — WP sends flat JSON { post_id, title, link, post_type, content, meta }.
 * Not gated by requireAdmin.
 */
export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: 'WP_PUBLISH_WEBHOOK_SECRET (or CONNECT_STUDIO_API_KEY) not set' },
      { status: 503 },
    )
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as WordpressPublishedPayload
  try {
    const result = await handleWordpressPublishWebhook(body)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('required')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[POST /api/webhooks/wordpress-published]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
