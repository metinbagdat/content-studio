import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import { withSegmentTag } from '@/lib/audience/segments'
import { resolveAudienceSegment } from '@/lib/audience/resolveAudienceSegment'
import { createPipeline } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sources = await prisma.contentSource.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ sources })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const title = String(body.title || '').trim()
  const content = String(body.content || '').trim()
  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }
  const incomingTags = Array.isArray(body.tags) ? body.tags.map(String) : []
  const { segment, source: segmentSource } = await resolveAudienceSegment(`${title}\n${content}`, incomingTags)
  const source = await prisma.contentSource.create({
    data: {
      title,
      content,
      category: String(body.category || 'general'),
      tags: withSegmentTag(incomingTags, segment),
    },
  })

  // Growth OS briefs: optional createPipeline (same pattern as WP ingest)
  const sourceKind = String(body.source || '').trim().toLowerCase()
  const meta = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
  const wantsPipeline =
    sourceKind === 'growth-os'
    || incomingTags.includes('growth-brief')
    || meta.createPipeline === true
  const skipPipeline = meta.createPipeline === false

  let pipelineId: string | null = null
  if (wantsPipeline && !skipPipeline) {
    try {
      const pipeline = await createPipeline(source.id, {
        includeMarchSong: false,
        autoPublish: false,
      })
      pipelineId = pipeline.id
    } catch (err) {
      return NextResponse.json({
        source,
        segment,
        segmentSource,
        pipelineError: err instanceof Error ? err.message : String(err),
      }, { status: 201 })
    }
  }

  return NextResponse.json({ source, segment, segmentSource, pipelineId }, { status: 201 })
}
