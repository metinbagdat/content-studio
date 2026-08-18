import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runHpvOpportunityScan } from '@/lib/seo/hpvCron'
import { HPV_MIN, VOLUME_MIN, scoreTopicOpportunity } from '@/lib/seo/keywordOpportunity'
import { dataForSeoConfigured } from '@/lib/seo/dataForSeo'
import { gscConfigured } from '@/lib/seo/gscQueries'
import { wordpressConfigured } from '@/lib/wordpress/publisher'
import { sendDerivedToWordPressDraft } from '@/lib/wordpress/sendDraft'
import { validateWithSafeSamurai } from '@/lib/wordpress/safeSamurai'
import { sendDraftToWordPress } from '@/lib/wordpress/publisher'
import type { WpContentPayload } from '@/lib/wordpress/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    configured: wordpressConfigured(),
    baseUrl: process.env.WP_BASE_URL || null,
    safeSamurai: process.env.SAFE_SAMURAI_ENABLED !== 'false',
    hpvGate: process.env.HPV_GATE_ENABLED !== 'false',
    hpvMin: HPV_MIN,
    volumeMin: VOLUME_MIN,
    dataForSeo: dataForSeoConfigured(),
    gsc: gscConfigured(),
  })
}

/**
 * POST body:
 * - { action: 'send-derived', derivedId }
 * - { action: 'send-payload', payload: WpContentPayload }
 * - { action: 'validate-only', payload | derivedId }
 * - { action: 'score-topic', title | derivedId }
 * - { action: 'hpv-scan', limit? }
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const action = String(body.action || 'send-derived')

  try {
    if (action === 'score-topic') {
      const title = String(body.title || body.derivedId || '')
      if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
      if (body.derivedId && !body.title) {
        const { buildPayloadFromDerived } = await import('@/lib/wordpress/sendDraft')
        const payload = await buildPayloadFromDerived(String(body.derivedId))
        const opportunity = await scoreTopicOpportunity(payload.title)
        return NextResponse.json({ opportunity })
      }
      const opportunity = await scoreTopicOpportunity(title)
      return NextResponse.json({ opportunity })
    }

    if (action === 'hpv-scan') {
      const limit = Number(body.limit || 8)
      const result = await runHpvOpportunityScan(limit)
      return NextResponse.json({ result })
    }

    if (action === 'send-derived') {
      const derivedId = String(body.derivedId || '')
      if (!derivedId) return NextResponse.json({ error: 'derivedId required' }, { status: 400 })
      const result = await sendDerivedToWordPressDraft(derivedId)
      const ok = Boolean(result.publish?.success)
      return NextResponse.json({ ...result, ok }, { status: ok || result.skipped ? 200 : 502 })
    }

    if (action === 'validate-only') {
      let payload = body.payload as WpContentPayload | undefined
      if (!payload && body.derivedId) {
        const { buildPayloadFromDerived } = await import('@/lib/wordpress/sendDraft')
        payload = await buildPayloadFromDerived(String(body.derivedId))
      }
      if (!payload?.title || !payload?.content) {
        return NextResponse.json({ error: 'payload or derivedId required' }, { status: 400 })
      }
      if (!payload.post_type) payload.post_type = 'article'
      const validation = await validateWithSafeSamurai(payload)
      return NextResponse.json({ validation })
    }

    if (action === 'send-payload') {
      const payload = body.payload as WpContentPayload
      if (!payload?.title || !payload?.content) {
        return NextResponse.json({ error: 'payload required' }, { status: 400 })
      }
      if (!payload.post_type) payload.post_type = 'article'
      const validation = await validateWithSafeSamurai(payload)
      if (!validation.approved) {
        return NextResponse.json({ validation, skipped: true, ok: false })
      }
      const publish = await sendDraftToWordPress(payload)
      return NextResponse.json({ validation, publish, ok: publish.success }, { status: publish.success ? 200 : 502 })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/wordpress]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
