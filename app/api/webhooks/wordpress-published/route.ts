import { NextRequest, NextResponse } from 'next/server'
import { ingestWordpressPublished, type WordpressPublishedPayload } from '@/lib/wordpress/ingestPublished'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function webhookKeyOk(req: NextRequest): boolean {
  const expected = process.env.CONNECT_STUDIO_API_KEY?.trim() || ''
  if (!expected) return false
  const provided =
    req.headers.get('x-api-key') ||
    req.headers.get('x-admin-key') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return Boolean(provided) && provided === expected
}

export async function POST(req: NextRequest) {
  if (!process.env.CONNECT_STUDIO_API_KEY?.trim()) {
    return NextResponse.json({ error: 'CONNECT_STUDIO_API_KEY not set' }, { status: 503 })
  }
  if (!webhookKeyOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as WordpressPublishedPayload
  try {
    const result = await ingestWordpressPublished(body)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('required')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('[POST /api/webhooks/wordpress-published]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
