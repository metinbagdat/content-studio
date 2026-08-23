import { NextRequest, NextResponse } from 'next/server'
import { ContentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import { createDerivedContent, setDerivedStatus } from '@/lib/content-crud'
import { detectAudienceSegment, isAudienceSegment, parseSegmentFromTags } from '@/lib/audience/segments'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const status = req.nextUrl.searchParams.get('status')
  const platform = req.nextUrl.searchParams.get('platform')?.toUpperCase() || ''
  const segmentParam = req.nextUrl.searchParams.get('segment')?.toLowerCase() || ''
  const take = Math.min(500, Math.max(50, Number(req.nextUrl.searchParams.get('take') || 300)))
  const items = await prisma.derivedContent.findMany({
    where: status ? { status: status as 'IN_REVIEW' | 'APPROVED' | 'DRAFT' } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
    include: { source: { select: { id: true, title: true, tags: true } } },
  })
  const filtered = items.filter((item) => {
    if (platform) {
      const meta =
        item.metadata && typeof item.metadata === 'object'
          ? (item.metadata as Record<string, unknown>)
          : {}
      const matchPlatform =
        meta.platform === platform ||
        (platform === 'LINKEDIN' && item.contentType === 'LINKEDIN_CAROUSEL') ||
        (platform === 'TWITTER' && item.contentType === 'TWITTER_THREAD') ||
        (platform === 'YOUTUBE' && (meta.atomKind === 'youtube_short' || meta.atomKind === 'long_form_video'))
      if (!matchPlatform) return false
    }
    if (segmentParam && isAudienceSegment(segmentParam)) {
      const meta =
        item.metadata && typeof item.metadata === 'object'
          ? (item.metadata as Record<string, unknown>)
          : {}
      const fromMeta = typeof meta.segment === 'string' ? meta.segment : null
      const fromTags = parseSegmentFromTags(item.source.tags)
      const seg = fromMeta || fromTags || detectAudienceSegment(`${item.title}\n${item.source.title}`)
      if (seg !== segmentParam) return false
    }
    return true
  })
  return NextResponse.json({
    items: filtered,
    totalFetched: items.length,
    platform: platform || null,
    segment: segmentParam || null,
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const action = String(body.action || '')

  if (action === 'quarantineVideos') {
    const { quarantineVideoScripts } = await import('@/lib/review/fault')
    const reason =
      String(body.reason || '').trim() ||
      'Video — prod/Vercel\'de üretilemez; Arı kuyruğuna alındı (yerel npm run dev)'
    const count = await quarantineVideoScripts(reason)
    return NextResponse.json({ count, reason })
  }

  if (action === 'quarantine') {
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : []
    if (!ids.length) {
      return NextResponse.json({ error: 'ids[] required' }, { status: 400 })
    }
    const reason = String(body.reason || '').trim() || 'Manuel arı kuyruğu'
    const { quarantineByIds } = await import('@/lib/review/fault')
    const count = await quarantineByIds(ids, reason)
    return NextResponse.json({ count, reason })
  }

  if (action === 'clearFault') {
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : []
    if (!ids.length) {
      return NextResponse.json({ error: 'ids[] required' }, { status: 400 })
    }
    const { clearReviewFault } = await import('@/lib/review/fault')
    for (const id of ids) await clearReviewFault(id)
    return NextResponse.json({ cleared: ids.length })
  }

  if (action === 'bulkApprove' || action === 'bulkReject') {
    let ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : []
    if (!ids.length) {
      return NextResponse.json({ error: 'ids[] required' }, { status: 400 })
    }
    const contentTypes = Array.isArray(body.contentTypes)
      ? body.contentTypes.map(String).filter(Boolean)
      : []
    if (contentTypes.length) {
      const allowed = new Set(contentTypes)
      const rows = await prisma.derivedContent.findMany({
        where: { id: { in: ids }, contentType: { in: contentTypes as ContentType[] } },
        select: { id: true },
      })
      ids = rows.map((r) => r.id)
      if (!ids.length) {
        return NextResponse.json({ error: 'Seçilen tiplerde eşleşen id yok', result: { processed: 0, errors: [] } })
      }
    }
    const { bulkSetDerivedStatus } = await import('@/lib/pipeline')
    const status = action === 'bulkApprove' ? 'APPROVED' : 'REJECTED'
    const result = await bulkSetDerivedStatus(ids, status, {
      autoMedia: Boolean(body.autoMedia),
      autoWpDraft: action === 'bulkApprove' && Boolean(body.autoWpDraft),
    })
    return NextResponse.json({ result })
  }

  if (action === 'create') {
    try {
      const contentType = String(body.contentType || '') as ContentType
      if (!Object.values(ContentType).includes(contentType)) {
        return NextResponse.json({ error: 'valid contentType required' }, { status: 400 })
      }
      const item = await createDerivedContent({
        sourceId: String(body.sourceId || ''),
        contentType,
        title: String(body.title || ''),
        content: String(body.content || ''),
        metadata: body.metadata,
        status: body.status === 'DRAFT' ? 'DRAFT' : 'IN_REVIEW',
      })
      return NextResponse.json({ item }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  const id = String(body.id || '')
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'id and action=approve|reject|create required' }, { status: 400 })
  }
  if (action === 'approve' && Boolean(body.autoMedia)) {
    const { bulkSetDerivedStatus } = await import('@/lib/pipeline')
    const result = await bulkSetDerivedStatus([id], 'APPROVED', { autoMedia: true })
    const derived = await prisma.derivedContent.findUnique({ where: { id } })
    return NextResponse.json({ derived, result })
  }
  const derived = await setDerivedStatus(id, action === 'approve' ? 'APPROVED' : 'REJECTED')
  return NextResponse.json({ derived })
}
