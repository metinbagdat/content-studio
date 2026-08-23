import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@content-studio/core/auth'
import { prisma } from '@/lib/prisma'
import {
  applyDistributionSchedule,
  previewDistributionSchedule,
} from '@/lib/scheduling/applyDistributionCalendar'
import { getAdaptiveSlotReport } from '@/lib/scheduling/postingPerformance'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelineId = req.nextUrl.searchParams.get('pipelineId')
  if (!pipelineId) {
    const pipelines = await prisma.contentPipeline.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 20,
      include: { source: { select: { id: true, title: true } } },
    })
    const withCalendar = pipelines.filter((p) => {
      const cfg = p.config && typeof p.config === 'object' ? (p.config as Record<string, unknown>) : {}
      return Boolean(cfg.distributionCalendar)
    })
    const adaptiveSlots = await getAdaptiveSlotReport()
    return NextResponse.json({ pipelines: withCalendar, adaptiveSlots })
  }

  const approvedOnly = req.nextUrl.searchParams.get('approvedOnly') === 'true'
  try {
    const preview = await previewDistributionSchedule(pipelineId, { approvedOnly })
    return NextResponse.json({ preview })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const action = String(body.action || 'apply')
  const pipelineId = String(body.pipelineId || '')

  if (!pipelineId) {
    return NextResponse.json({ error: 'pipelineId required' }, { status: 400 })
  }

  if (action === 'preview') {
    try {
      const preview = await previewDistributionSchedule(pipelineId, {
        approvedOnly: body.approvedOnly !== false,
      })
      return NextResponse.json({ preview })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (action === 'apply') {
    try {
      const result = await applyDistributionSchedule(pipelineId, {
        approvedOnly: body.approvedOnly !== false,
        reschedule: body.reschedule === true,
      })
      return NextResponse.json({ result })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
